/**
 * Opportunity Score Engine (v1)
 * Função pura: recebe os fatores normalizados (0-100 cada) e devolve
 * o score final ponderado + confidence score (quantos fatores tinham
 * dado real vs. estimado/ausente).
 *
 * Pesos calibráveis — mesmo padrão de calibração pós-30-dias do WDO.
 */

const PESOS = {
  commission: 0.25,   // % e valor absoluto da comissão
  temperature: 0.25,  // demanda na plataforma (temperatura Hotmart, destaque Kiwify)
  trend: 0.20,        // crescimento de busca 30d (Google Trends)
  competition: 0.15,  // concorrência (invertido: menos afiliados = mais pontos)
  landing: 0.15       // qualidade da página de vendas
};

/**
 * @param {object} fatores — { commission, temperature, trend, competition, landing }
 *   Cada fator: número 0-100 ou null (dado indisponível).
 * @returns {{ opportunityScore: number, confidenceScore: number, detalhes: object }}
 */
function calcularOpportunityScore(fatores) {
  let somaPonderada = 0;
  let somaPesosDisponiveis = 0;
  let fatoresComDado = 0;
  const totalFatores = Object.keys(PESOS).length;
  const detalhes = {};

  for (const [nome, peso] of Object.entries(PESOS)) {
    const valor = fatores[nome];
    if (typeof valor === 'number' && !Number.isNaN(valor)) {
      const clamped = Math.max(0, Math.min(100, valor));
      somaPonderada += clamped * peso;
      somaPesosDisponiveis += peso;
      fatoresComDado++;
      detalhes[nome] = clamped;
    } else {
      detalhes[nome] = null;
    }
  }

  // Score é a média ponderada apenas dos fatores disponíveis —
  // não penaliza dado ausente no score, mas reflete no confidence.
  const opportunityScore = somaPesosDisponiveis > 0
    ? Math.round(somaPonderada / somaPesosDisponiveis)
    : 0;

  const confidenceScore = Math.round((fatoresComDado / totalFatores) * 100);

  return { opportunityScore, confidenceScore, detalhes };
}

/**
 * Normaliza comissão pra escala 0-100.
 * Heurística v1: comissão de 50%+ com valor absoluto >= R$50 é topo de escala.
 */
function normalizarComissao(pct, valorAbsoluto) {
  if (pct == null && valorAbsoluto == null) return null;
  const notaPct = pct != null ? Math.min(100, (pct / 60) * 100) : null;
  const notaValor = valorAbsoluto != null ? Math.min(100, (valorAbsoluto / 100) * 100) : null;
  if (notaPct != null && notaValor != null) return Math.round(notaPct * 0.5 + notaValor * 0.5);
  return Math.round(notaPct ?? notaValor);
}

module.exports = { calcularOpportunityScore, normalizarComissao, PESOS };
