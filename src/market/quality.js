/**
 * SOURCE SCORE — confiabilidade de cada plataforma (0-100).
 * Influencia o Opportunity Score como multiplicador suave: uma plataforma
 * de score 75 reduz o score final em ~5%, não o domina. Facilmente
 * configurável aqui ou via env SOURCE_SCORES (JSON).
 */
const SOURCE_SCORES_DEFAULT = {
  hotmart: 98,
  eduzz: 92,
  monetizze: 90,
  kiwify: 88,
  braip: 85,
  cakto: 80,
  kairos: 75
};

function sourceScore(platform) {
  let scores = SOURCE_SCORES_DEFAULT;
  if (process.env.SOURCE_SCORES) {
    try { scores = { ...SOURCE_SCORES_DEFAULT, ...JSON.parse(process.env.SOURCE_SCORES) }; }
    catch (_) { /* env inválido, usa default */ }
  }
  return scores[platform] ?? 70; // plataforma desconhecida = confiança conservadora
}

/**
 * Multiplicador aplicado ao Opportunity Score:
 * score 100 → 1.0 | score 75 → 0.95 | score 50 → 0.90
 * (efeito deliberadamente suave — confiabilidade modula, não decide)
 */
function multiplicadorFonte(platform) {
  return 0.8 + (sourceScore(platform) / 100) * 0.2;
}

/**
 * AUTO REJECT — filtros de corte ANTES de gastar processamento (trends,
 * enrichment, persistência). Produto rejeitado nem entra no radar.
 * Limiares configuráveis via env.
 */
const LIMIARES = () => ({
  comissaoPctMinima: Number(process.env.REJECT_COMISSAO_PCT_MIN ?? 20),
  comissaoValorMinimo: Number(process.env.REJECT_COMISSAO_VALOR_MIN ?? 15),
  precoMinimo: Number(process.env.REJECT_PRECO_MIN ?? 10),
  ratingMinimo: Number(process.env.REJECT_RATING_MIN ?? 3.5)
});

/**
 * @returns {{ aprovado: boolean, motivo?: string }}
 */
function autoReject(produto) {
  const t = LIMIARES();

  // Sem título ou sem qualquer dado de comissão: não dá pra avaliar nem vender
  if (!produto.title) return { aprovado: false, motivo: 'sem_titulo' };

  const temComissao = produto.commissionPct != null || produto.commissionValue != null;
  if (temComissao) {
    if (produto.commissionPct != null && produto.commissionPct < t.comissaoPctMinima
        && (produto.commissionValue == null || produto.commissionValue < t.comissaoValorMinimo)) {
      return { aprovado: false, motivo: `comissao_baixa_${produto.commissionPct}pct` };
    }
  }

  if (produto.price != null && produto.price < t.precoMinimo) {
    return { aprovado: false, motivo: `preco_baixo_${produto.price}` };
  }

  if (produto.rating != null && produto.rating < t.ratingMinimo) {
    return { aprovado: false, motivo: `rating_baixo_${produto.rating}` };
  }

  return { aprovado: true };
}

module.exports = { sourceScore, multiplicadorFonte, autoReject };
