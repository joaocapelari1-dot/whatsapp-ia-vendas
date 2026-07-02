const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../lib/supabase');
const { montarPromptSistema } = require('./promptVendedor');
const { tools } = require('./tools');
const { gerarLinkPagamento } = require('./mercadoPago');
const { enviarMensagemWhatsapp } = require('./evolutionApi');

const anthropic = new Anthropic();

async function processarComIA(lead, mensagemRecebida, produto) {
  // 1. Salva mensagem do lead
  await supabase.from('conversas').insert({
    lead_id: lead.id,
    produto_id: produto?.id || null,
    remetente: 'lead',
    mensagem: mensagemRecebida
  });

  // 2. Busca histórico recente (contexto)
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

  // 3. Se ainda não tem produto identificado
  if (!produto) {
    const respostaSemProduto = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: 'Você é um vendedor via WhatsApp. O cliente chegou sem indicar qual produto quer. Pergunte de forma natural e curta qual produto despertou o interesse dele.',
      messages: mensagens
    });
    const texto = respostaSemProduto.content.find(c => c.type === 'text')?.text;
    if (texto) await enviarERegistrar(lead, texto);
    return;
  }

  // 4. Chamada principal com function calling
  // O system prompt (montarPromptSistema) já vem em blocos com cache_control,
  // então o conhecimento do produto e as tools ficam em cache por ~5 min:
  // primeira chamada da conversa paga preço cheio, as seguintes pagam 10%
  // do preço de entrada nessa parte, mesmo trocando de lead que fale do
  // mesmo produto dentro da janela de cache.
  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: montarPromptSistema(produto),
    messages: mensagens,
    tools
  });

  // Log simples pra acompanhar o efeito do cache (opcional, útil nos testes)
  const uso = resposta.usage;
  if (uso) {
    console.log(
      `[custo] input=${uso.input_tokens} cache_write=${uso.cache_creation_input_tokens || 0} ` +
      `cache_read=${uso.cache_read_input_tokens || 0} output=${uso.output_tokens}`
    );
  }

  // 5. Processa blocos de resposta (texto e/ou tool_use)
  for (const bloco of resposta.content) {
    if (bloco.type === 'text' && bloco.text.trim()) {
      await enviarERegistrar(lead, bloco.text, produto.id);
    }

    if (bloco.type === 'tool_use' && bloco.name === 'gerar_link_pagamento') {
      const link = await gerarLinkPagamento(produto, lead);
      const msg = `Perfeito! Aqui está o link para finalizar: ${link}`;
      await enviarERegistrar(lead, msg, produto.id);

      await supabase.from('vendas').insert({
        lead_id: lead.id,
        produto_id: produto.id,
        valor: produto.preco,
        link_pagamento_gerado: link,
        status_pagamento: 'pendente'
      });

      await supabase.from('leads').update({ status_funil: 'interessado' }).eq('id', lead.id);
    }

    if (bloco.type === 'tool_use' && bloco.name === 'escalar_humano') {
      await supabase.from('leads').update({ status_funil: 'escalado' }).eq('id', lead.id);
      // opcional: notificação pra você via Telegram, igual no LeilaoWDO
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

module.exports = { processarComIA };
