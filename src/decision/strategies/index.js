const price    = require('./objection_price');
const trust    = require('./objection_trust');
const shipping = require('./objection_shipping');
const guarantee = require('./objection_guarantee');
const quality  = require('./objection_quality');

const MAP = {
  preco:       price,
  confianca:   trust,
  marca:       trust,      // marca → mesma sequência de confiança
  entrega:     shipping,
  garantia:    guarantee,
  qualidade:   quality,
  necessidade: quality,    // necessidade → evidências de valor
  urgencia:    trust       // urgência → não pressionar, construir confiança
};

/**
 * Retorna a instrução de tratamento de objeção para um dado tipo e passo.
 * @param {string} objecao - tipo de objeção (ex: 'preco', 'confianca')
 * @param {string} passo   - passo da sequência (ex: 'valor', 'prova_social')
 * @returns {string} instrução para o Prompt Builder
 */
function instrucaoDeObjecao(objecao, passo) {
  const strategy = MAP[objecao];
  if (!strategy) return null;
  return strategy.instrucao(passo);
}

module.exports = { instrucaoDeObjecao, MAP };
