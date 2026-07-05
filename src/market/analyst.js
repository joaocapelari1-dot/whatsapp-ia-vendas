const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

/**
 * AI Market Analyst: recebe o resultado consolidado do dia e gera um
 * relatório executivo curto pro Telegram. O LLM só escreve — os números
 * e rankings vêm prontos do pipeline (mesmo princípio do Sales Brain).
 */
async function gerarRelatorio({ totalAnalisados, rejeitadosHoje, porPlataforma, top10, movimento, duplicadosCrossPlataforma }) {
  const dados = {
    data: new Date().toLocaleDateString('pt-BR'),
    totalAnalisados,
    rejeitadosPeloFiltroAutomatico: rejeitadosHoje ?? 0,
    porPlataforma,
    top10: top10.map(p => ({
      nome: p.title || p.nome,
      plataforma: p.platform || p.plataforma,
      score: p.opportunityScore,
      confidence: p.confidenceScore,
      comissao_pct: p.commissionPct ?? p.comissao_pct,
      preco: p.price ?? p.preco,
      nicho: p.dna?.nicho || null,
      codigo_importacao: `${(p.platform || p.plataforma || '').toUpperCase()}_${p.externalId || p.external_id}`
    })),
    mesmoProdutoEmVariasPlataformas: (duplicadosCrossPlataforma || []).map(d => ({
      titulo: d.titulo,
      melhorPlataforma: d.melhorPlataforma,
      comparacao: d.comparacao
    })),
    emAceleracao: movimento.subiram.slice(0, 5).map(p => ({
      nome: p.title || p.nome, score: p.opportunityScore, delta: p.delta
    })),
    perdendoForca: movimento.cairam.slice(0, 3).map(p => ({
      nome: p.title || p.nome, score: p.opportunityScore, delta: p.delta
    })),
    novosNoRadar: movimento.novos.length
  };

  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `Você é um analista de mercado de produtos de afiliado. Gere um relatório executivo CURTO em português para envio via Telegram (texto puro, emojis pontuais, sem markdown pesado).

Estrutura:
1. Cabeçalho com data, total analisado e quantos foram descartados pelo filtro automático
2. Top 3 oportunidades (nome, score, nicho se disponível, por que se destaca — comissão/tendência)
3. Se houver o MESMO produto em várias plataformas: destaque qual plataforma paga melhor
4. Produtos em aceleração (se houver)
5. Alerta de produtos perdendo força (se houver)
6. Quantos produtos novos entraram no radar
7. Linha final: "Para importar: /importar CODIGO" usando o codigo_importacao do melhor produto

Seja direto e factual. Se o confidence de um produto for baixo (<50), mencione que os dados são parciais. Não invente números que não estão nos dados.`,
    messages: [{ role: 'user', content: JSON.stringify(dados) }]
  });

  return resposta.content.find(c => c.type === 'text')?.text || 'Relatório indisponível.';
}

module.exports = { gerarRelatorio };
