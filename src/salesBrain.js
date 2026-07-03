const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../lib/supabase');
const { classificar } = require('./agents/classification/classify');
const { buscarOuCriarEstado, atualizarEstado, acrescentarLimitado } = require('./conversation/state');
const { calcularNovoScore } = require('./decision/buyScore');
const { decidirEstrategia, avancarEstagio, ESTRATEGIAS } = require('./decision/engine');
const { montarPrompt } = require('./prompt/builder');
const { validarResposta } = require('./response/validator');
const { registrarDecisao } = require('./utils/decisionLog');
const { tools } = require('../services/tools');
const { gerarLinkPagamento } = require('../services/mercadoPago');
const { enviarMensagemWhatsapp } = require('../services/evolutionApi');

const anthropic = new Anthropic();

/**
 * Ponto de entrada do Sales Brain. Substitui o antigo processarComIA:
 * agora a decisão de ESTRATÉGIA vem do Decision Engine (backend), e o LLM
 * só entra pra classificar a intenção e depois pra escrever a resposta
 * dentro da estratégia já decidida.
 */
async function processarMensagem(lead, mensagemRecebida, produto) {
  // 1. Salva mensagem do lead no histórico
  await supabase.from('conversas').insert({
    lead_id: lead.id,
    produto_id: produto?.id || null,
    remetente: 'lead',
    mensagem: mensagemRecebida
  });

  // 2. Busca/cria o estado da conversa
  const estado = await buscarOuCriarEstado(lead.id, produto?.id);

  // 3. Classifica a mensagem (chamada curta e barata)
  const classificacao = await classificar(mensagemRecebida, estado);

  // 4. Recalcula buy score e estágio
  const novoScore = calcularNovoScore(estado.buy_score, classificacao.buyScoreDelta);
  const novoEstagio = avancarEstagio(estado.stage, classificacao.stage);
  const novasObjecoes = acrescentarLimitado(estado.objections, classificacao.objection);
  const novasPerguntas = acrescentarLimitado(estado.last_questions, mensagemRecebida, 10);

  // 5. Decision Engine escolhe a ESTRATÉGIA (não a resposta)
  const { estrategia, motivo } = decidirEstrategia({
    intent: classificacao.intent,
    emotion: classificacao.emotion,
    objection: classificacao.objection,
    buyScore: novoScore,
    stage: novoEstagio,
    waitingHuman: estado.waiting_human
  });

  // 6. Atualiza o estado já com a decisão tomada
  const estadoAtualizado = await atualizarEstado(lead.id, {
    stage: novoEstagio,
    buy_score: novoScore,
    objections: novasObjecoes,
    last_questions: novasPerguntas,
    sentiment: classificacao.emotion,
    messages_count: (estado.messages_count || 0) + 1,
    waiting_human: estrategia === ESTRATEGIAS.TRANSFERIR_HUMANO ? true : estado.waiting_human
  });

  // 7. Se já escalado ou sem produto identificado ainda, trata caminho curto
  if (estrategia === ESTRATEGIAS.TRANSFERIR_HUMANO) {
    const msg = 'Um momento, já vou te colocar em contato com a equipe pra te ajudar melhor nisso. 🙂';
    await enviarERegistrar(lead, msg, produto?.id);
    await registrarDecisao({
      leadId: lead.id, produtoId: produto?.id, mensagemRecebida, classificacao,
      estrategia, motivoEstrategia: motivo, respostaGerada: msg, validacao: { valido: true }
    });
    return;
  }

  if (!produto && estrategia === ESTRATEGIAS.COLETAR_INFO) {
    const respostaSemProduto = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: 'Você é um vendedor via WhatsApp. Pergunte de forma natural e curta qual produto despertou o interesse do cliente.',
      messages: [{ role: 'user', content: mensagemRecebida }]
    });
    const texto = respostaSemProduto.content.find(c => c.type === 'text')?.text;
    if (texto) await enviarERegistrar(lead, texto, null);
    return;
  }

  // 8. Busca histórico recente pra dar contexto ao LLM
  const { data: historico } = await supabase
    .from('conversas')
    .select('remetente, mensagem')
    .eq('lead_id', lead.id)
    .order('criado_em', { ascending: true })
    .limit(20);

  const mensagens = (historico || []).map(h => ({
    role: h.remetente === 'lead' ? 'user' : 'assistant',
    content: h.mensagem
  }));

  // 9. Prompt Builder monta o system prompt já com a estratégia decidida
  const systemPrompt = montarPrompt({ produto, estrategia, perfilCliente: null });

  // 10. LLM só aqui entra pra transformar estratégia em linguagem natural
  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: mensagens,
    tools
  });

  let respostaTexto = '';

  for (const bloco of resposta.content) {
    if (bloco.type === 'text' && bloco.text.trim()) {
      respostaTexto = bloco.text;

      // 11. Response Validator antes de enviar
      const validacao = validarResposta(bloco.text, { produto });

      if (!validacao.valido) {
        console.warn(`Resposta invalidada (${validacao.motivo}), escalando pra humano.`);
        const msgFallback = 'Deixa eu confirmar uma informação com a equipe rapidinho e já te retorno.';
        await enviarERegistrar(lead, msgFallback, produto?.id);
        await atualizarEstado(lead.id, { waiting_human: true });
        await registrarDecisao({
          leadId: lead.id, produtoId: produto?.id, mensagemRecebida, classificacao,
          estrategia, motivoEstrategia: motivo, respostaGerada: bloco.text, validacao
        });
        return;
      }

      await enviarERegistrar(lead, bloco.text, produto?.id);
      await registrarDecisao({
        leadId: lead.id, produtoId: produto?.id, mensagemRecebida, classificacao,
        estrategia, motivoEstrategia: motivo, respostaGerada: bloco.text, validacao
      });
    }

    if (bloco.type === 'tool_use' && bloco.name === 'gerar_link_pagamento') {
      const link = await gerarLinkPagamento(produto, lead);
      const msg = `Perfeito! Aqui está o link para finalizar: ${link}`;
      await enviarERegistrar(lead, msg, produto?.id);

      await supabase.from('vendas').insert({
        lead_id: lead.id,
        produto_id: produto.id,
        valor: produto.preco,
        link_pagamento_gerado: link,
        status_pagamento: 'pendente'
      });

      await supabase.from('leads').update({ status_funil: 'interessado' }).eq('id', lead.id);
      await atualizarEstado(lead.id, { checkout_generated: true });
    }

    if (bloco.type === 'tool_use' && bloco.name === 'escalar_humano') {
      await supabase.from('leads').update({ status_funil: 'escalado' }).eq('id', lead.id);
      await atualizarEstado(lead.id, { waiting_human: true });
    }
  }
}

async function enviarERegistrar(lead, mensagem, produtoId = null) {
  await enviarMensagemWhatsapp(lead.telefone, mensagem);
  await supabase.from('conversas').insert({
    lead_id: lead.id,
    produto_id: produtoId,
    remetente: 'ia',
    mensagem
  });
}

module.exports = { processarMensagem };
