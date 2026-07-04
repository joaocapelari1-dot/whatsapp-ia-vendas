const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

/**
 * AI Market Analyst: recebe o resultado consolidado do dia e gera um
 * relatório executivo curto pro Telegram. O LLM só escreve — os números
 * e rankings vêm prontos do pipeline (mesmo princípio do Sales Brain).
 */
async function gerarRelatorio({ totalAnalisados, porPlataforma, top10, movimento }) {
  const dados = {
    data: new Date().toLocaleDateString('pt-BR'),
    totalAnalisados,
    porPlataforma,
    top10: top10.map(p => ({
      nome: p.nome,
      plataforma: p.plataforma,
      score: p.opportunityScore,
      confidence: p.confidenceScore,
      comissao_pct: p.comissao_pct,
      preco: p.preco,
      codigo_importacao: `${p.plataforma.toUpperCase()}_${p.external_id}`
    })),
    emAceleracao: movimento.subiram.slice(0, 5).map(p => ({
      nome: p.nome, score: p.opportunityScore, delta: p.delta
    })),
    perdendoForca: movimento.cairam.slice(0, 3).map(p => ({
      nome: p.nome, score: p.opportunityScore, delta: p.delta
    })),
    novosNoRadar: movimento.novos.length
  };

  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `Você é um analista de mercado de produtos de afiliado. Gere um relatório executivo CURTO em português para envio via Telegram (texto puro, emojis pontuais, sem markdown pesado).

Estrutura:
1. Cabeçalho com data e total analisado
2. Top 3 oportunidades (nome, score, por que se destaca — comissão/tendência)
3. Produtos em aceleração (se houver)
4. Alerta de produtos perdendo força (se houver)
5. Quantos produtos novos entraram no radar
6. Linha final: "Para importar: /importar CODIGO" usando o codigo_importacao do melhor produto

Seja direto e factual. Se o confidence de um produto for baixo (<50), mencione que os dados são parciais. Não invente números que não estão nos dados.`,
    messages: [{ role: 'user', content: JSON.stringify(dados) }]
  });

  return resposta.content.find(c => c.type === 'text')?.text || 'Relatório indisponível.';
}

module.exports = { gerarRelatorio };
