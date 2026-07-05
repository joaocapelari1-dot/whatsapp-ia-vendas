/**
 * Modelos canônicos do Market Brain.
 * Princípio: módulos não conversam entre si diretamente — trocam apenas
 * estes formatos padronizados. Connector coleta cru; Normalizer converte
 * pra cá; todo o resto (score, reject, fingerprint, enrichment, comparator,
 * persistência) só conhece o modelo canônico.
 */

/**
 * Produto canônico — única forma que circula no sistema após normalização.
 * @typedef {object} Product
 * @property {string} externalId
 * @property {string} platform      — hotmart | kiwify | eduzz | braip | monetizze | cakto | kairos
 * @property {string} title
 * @property {string|null} category
 * @property {number|null} price
 * @property {number|null} commissionPct
 * @property {number|null} commissionValue
 * @property {number|null} temperature  — métrica de demanda da plataforma, 0-100 quando existir
 * @property {number|null} rating
 * @property {number|null} reviews
 * @property {string|null} url
 * @property {string} lastUpdate    — ISO timestamp da coleta
 * @property {string|null} fingerprint — preenchido pelo módulo fingerprint
 * @property {object|null} dna         — preenchido pelo enrichment (Market DNA)
 */

/** Cria um Product canônico validando o mínimo necessário. */
function criarProduto(bruto) {
  if (!bruto || !bruto.external_id || !bruto.nome) return null;

  return {
    externalId: String(bruto.external_id),
    platform: bruto.plataforma,
    title: String(bruto.nome).trim(),
    category: bruto.categoria ?? null,
    price: numOuNull(bruto.preco),
    commissionPct: numOuNull(bruto.comissao_pct),
    commissionValue: numOuNull(bruto.comissao_valor),
    temperature: numOuNull(bruto.temperatura),
    rating: numOuNull(bruto.rating),
    reviews: numOuNull(bruto.reviews),
    url: bruto.url ?? null,
    lastUpdate: new Date().toISOString(),
    fingerprint: null,
    dna: null,
    // preservado pra trends e persistência legada
    trend_score: bruto.trend_score ?? null
  };
}

function numOuNull(v) {
  return v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
}

module.exports = { criarProduto };
