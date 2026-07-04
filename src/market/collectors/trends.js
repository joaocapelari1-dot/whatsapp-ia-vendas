/**
 * Coletor Google Trends v1.
 * Usa a lib google-trends-api (sem chave). Instável às vezes — o Google muda
 * o endpoint interno — então todo erro é tratado como "dado indisponível"
 * (trend = null), nunca derruba o pipeline.
 */
const googleTrends = require('google-trends-api');

/**
 * Calcula um trend score 0-100 pra um termo:
 * compara a média dos últimos 7 dias com a média dos 30 dias — crescimento
 * recente pontua alto.
 */
async function trendScore(termo) {
  try {
    const raw = await googleTrends.interestOverTime({
      keyword: termo,
      geo: 'BR',
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    const parsed = JSON.parse(raw);
    const pontos = parsed?.default?.timelineData || [];
    if (pontos.length < 8) return null;

    const valores = pontos.map(p => Number(p.value?.[0] ?? 0));
    const ultimos7 = valores.slice(-7);
    const media30 = valores.reduce((a, b) => a + b, 0) / valores.length;
    const media7 = ultimos7.reduce((a, b) => a + b, 0) / ultimos7.length;

    if (media30 === 0) return media7 > 0 ? 70 : null;

    // Razão de crescimento: 1.0 = estável (50 pts), 2.0+ = dobrou (100 pts)
    const razao = media7 / media30;
    const score = Math.round(Math.max(0, Math.min(100, 50 * razao)));
    return score;
  } catch (erro) {
    console.warn(`[market] Trends indisponível para "${termo}": ${erro.message}`);
    return null;
  }
}

/**
 * Enriquece uma lista de produtos com trend score, com throttle simples
 * pra não tomar rate limit do Google (1 req a cada ~2s).
 */
async function enriquecerComTrends(produtos, { maxConsultas = 30 } = {}) {
  const resultado = [];
  let consultas = 0;

  for (const produto of produtos) {
    let trend = null;
    if (consultas < maxConsultas && produto.nome) {
      // Usa as 3 primeiras palavras significativas do nome como termo
      const termo = produto.nome.split(/\s+/).slice(0, 3).join(' ');
      trend = await trendScore(termo);
      consultas++;
      await new Promise(r => setTimeout(r, 2000));
    }
    resultado.push({ ...produto, trend_score: trend });
  }

  return resultado;
}

module.exports = { trendScore, enriquecerComTrends };
