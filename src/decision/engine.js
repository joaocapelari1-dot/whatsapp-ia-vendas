const { LIMIAR_CHECKOUT, LIMIAR_OBJECAO_ATIVA } = require('./buyScore');

// Estratégias suportadas na Fase 1 (Fase 2 adiciona mais nuance por objeção)
const ESTRATEGIAS = {
  RESPONDER_INFORMACAO: 'responder_informacao',
  COLETAR_INFO: 'coletar_info',
  CONDUZIR_CHECKOUT: 'conduzir_checkout',
  TRANSFERIR_HUMANO: 'transferir_humano',
  ENCERRAR: 'encerrar'
};

/**
 * Decide a ESTRATÉGIA a partir do estado da conversa + classificação da
 * mensagem atual. Não gera texto nenhum — isso é trabalho do Prompt Builder
 * + LLM depois. Aqui é só regra de negócio determinística.
 */
function decidirEstrategia({ intent, emotion, objection, buyScore, stage, waitingHuman }) {
  // Já escalado pra humano — não decide mais nada sozinho até liberar
  if (waitingHuman) {
    return { estrategia: ESTRATEGIAS.TRANSFERIR_HUMANO, motivo: 'conversa_ja_escalada' };
  }

  // Reclamação, raiva ou pedido explícito de humano vão direto pra escalação
  if (intent === 'complaint' || intent === 'angry' || intent === 'human_support') {
    return { estrategia: ESTRATEGIAS.TRANSFERIR_HUMANO, motivo: `intent_${intent}` };
  }

  // Despedida — encerra educadamente, sem forçar mais nada
  if (intent === 'goodbye') {
    return { estrategia: ESTRATEGIAS.ENCERRAR, motivo: 'cliente_se_despediu' };
  }

  // Intenção clara de compra ou score alto → conduz pro checkout
  if (intent === 'buy' || intent === 'checkout' || buyScore >= LIMIAR_CHECKOUT) {
    return { estrategia: ESTRATEGIAS.CONDUZIR_CHECKOUT, motivo: `buyScore_${buyScore}_intent_${intent}` };
  }

  // Objeção detectada com score ainda baixo → prioriza informação/confiança
  // antes de empurrar venda (Fase 2 vai detalhar por categoria de objeção)
  if (objection && buyScore < LIMIAR_OBJECAO_ATIVA) {
    return { estrategia: ESTRATEGIAS.RESPONDER_INFORMACAO, motivo: `objecao_${objection}_score_baixo` };
  }

  // Ainda não sabemos o produto/interesse do cliente
  if (stage === 'discovery' && intent === 'unknown') {
    return { estrategia: ESTRATEGIAS.COLETAR_INFO, motivo: 'discovery_sem_produto_claro' };
  }

  // Caso padrão: responde com informação relevante
  return { estrategia: ESTRATEGIAS.RESPONDER_INFORMACAO, motivo: 'default' };
}

/**
 * Calcula o novo estágio do funil a partir da estratégia escolhida e do
 * estágio sugerido pela classificação. Regra simples: nunca regride o
 * estágio, exceto se a conversa esfriar (tratado pelo decaimento).
 */
const ORDEM_ESTAGIOS = [
  'discovery', 'interest', 'comparison', 'objection',
  'negotiation', 'ready_to_buy', 'checkout', 'after_sales'
];

function avancarEstagio(estagioAtual, estagioSugerido) {
  const idxAtual = ORDEM_ESTAGIOS.indexOf(estagioAtual);
  const idxSugerido = ORDEM_ESTAGIOS.indexOf(estagioSugerido);
  if (idxSugerido > idxAtual) return estagioSugerido;
  return estagioAtual;
}

module.exports = { ESTRATEGIAS, decidirEstrategia, avancarEstagio };
