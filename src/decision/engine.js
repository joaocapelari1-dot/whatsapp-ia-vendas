const { LIMIAR_CHECKOUT, LIMIAR_OBJECAO_ATIVA } = require('./buyScore');

const ESTRATEGIAS = {
  RESPONDER_INFORMACAO:    'responder_informacao',
  COLETAR_INFO:            'coletar_info',
  CONDUZIR_CHECKOUT:       'conduzir_checkout',
  TRANSFERIR_HUMANO:       'transferir_humano',
  ENCERRAR:                'encerrar',
  // Fase 2 — por categoria de objeção
  QUEBRAR_OBJECAO_PRECO:      'quebrar_objecao_preco',
  QUEBRAR_OBJECAO_CONFIANCA:  'quebrar_objecao_confianca',
  QUEBRAR_OBJECAO_ENTREGA:    'quebrar_objecao_entrega',
  QUEBRAR_OBJECAO_GARANTIA:   'quebrar_objecao_garantia',
  QUEBRAR_OBJECAO_QUALIDADE:  'quebrar_objecao_qualidade'
};

// Mapeia tipo de objeção → estratégia específica
const ESTRATEGIA_POR_OBJECAO = {
  preco:       ESTRATEGIAS.QUEBRAR_OBJECAO_PRECO,
  confianca:   ESTRATEGIAS.QUEBRAR_OBJECAO_CONFIANCA,
  marca:       ESTRATEGIAS.QUEBRAR_OBJECAO_CONFIANCA,
  entrega:     ESTRATEGIAS.QUEBRAR_OBJECAO_ENTREGA,
  garantia:    ESTRATEGIAS.QUEBRAR_OBJECAO_GARANTIA,
  qualidade:   ESTRATEGIAS.QUEBRAR_OBJECAO_QUALIDADE,
  necessidade: ESTRATEGIAS.QUEBRAR_OBJECAO_QUALIDADE,
  urgencia:    ESTRATEGIAS.QUEBRAR_OBJECAO_CONFIANCA
};

/**
 * Decide a ESTRATÉGIA a partir do estado da conversa + classificação.
 * Fase 2: objeções mapeadas para estratégias específicas em vez de genéricas.
 */
function decidirEstrategia({ intent, emotion, objection, objecaoDominante, buyScore, stage, waitingHuman }) {
  if (waitingHuman) {
    return { estrategia: ESTRATEGIAS.TRANSFERIR_HUMANO, motivo: 'conversa_ja_escalada' };
  }

  if (intent === 'complaint' || intent === 'angry' || intent === 'human_support') {
    return { estrategia: ESTRATEGIAS.TRANSFERIR_HUMANO, motivo: `intent_${intent}` };
  }

  if (intent === 'goodbye') {
    return { estrategia: ESTRATEGIAS.ENCERRAR, motivo: 'cliente_se_despediu' };
  }

  if (intent === 'buy' || intent === 'checkout' || buyScore >= LIMIAR_CHECKOUT) {
    return { estrategia: ESTRATEGIAS.CONDUZIR_CHECKOUT, motivo: `buyScore_${buyScore}_intent_${intent}` };
  }

  // Fase 2: objeção com estratégia específica em vez de genérica
  const objecaoParaResolver = objecaoDominante || objection;
  if (objecaoParaResolver && buyScore < LIMIAR_OBJECAO_ATIVA) {
    const estrategiaEspecifica = ESTRATEGIA_POR_OBJECAO[objecaoParaResolver];
    if (estrategiaEspecifica) {
      return {
        estrategia: estrategiaEspecifica,
        motivo: `objecao_${objecaoParaResolver}_score_${buyScore}`
      };
    }
  }

  if (stage === 'discovery' && intent === 'unknown') {
    return { estrategia: ESTRATEGIAS.COLETAR_INFO, motivo: 'discovery_sem_produto_claro' };
  }

  return { estrategia: ESTRATEGIAS.RESPONDER_INFORMACAO, motivo: 'default' };
}

const ORDEM_ESTAGIOS = [
  'discovery', 'interest', 'comparison', 'objection',
  'negotiation', 'ready_to_buy', 'checkout', 'after_sales'
];

function avancarEstagio(estagioAtual, estagioSugerido) {
  const idxAtual   = ORDEM_ESTAGIOS.indexOf(estagioAtual);
  const idxSugerido = ORDEM_ESTAGIOS.indexOf(estagioSugerido);
  if (idxSugerido > idxAtual) return estagioSugerido;
  return estagioAtual;
}

module.exports = { ESTRATEGIAS, decidirEstrategia, avancarEstagio, ESTRATEGIA_POR_OBJECAO };
