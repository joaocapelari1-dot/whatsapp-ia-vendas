/**
 * Objection Engine — Fase 2
 *
 * Recebe a objeção categorizada pelo classify.js e o histórico de objeções
 * para decidir em qual PASSO da sequência de tratamento estamos.
 *
 * Sequências por categoria (nunca pula etapa, nunca desconto automático):
 *
 * preco:     valor → prova_social → garantia → parcelamento → fechar
 * confianca: prova_social → garantia → transparencia → fechar
 * entrega:   prazo_concreto → experiencia_outros → garantia → fechar
 * garantia:  politica_clara → suporte → sem_risco → fechar
 * qualidade: evidencias → avaliacoes → garantia → fechar
 * marca:     reputacao → historico → casos_reais → fechar
 * necessidade: entender_dor → valor_transformacao → urgencia → fechar
 * urgencia:  sem_pressao → motivo_certo → oportunidade → fechar
 */

const SEQUENCIAS = {
  preco:      ['valor', 'prova_social', 'garantia', 'parcelamento', 'fechar'],
  confianca:  ['prova_social', 'garantia', 'transparencia', 'fechar'],
  entrega:    ['prazo_concreto', 'experiencia_outros', 'garantia', 'fechar'],
  garantia:   ['politica_clara', 'suporte', 'sem_risco', 'fechar'],
  qualidade:  ['evidencias', 'avaliacoes', 'garantia', 'fechar'],
  marca:      ['reputacao', 'historico', 'casos_reais', 'fechar'],
  necessidade:['entender_dor', 'valor_transformacao', 'urgencia', 'fechar'],
  urgencia:   ['sem_pressao', 'motivo_certo', 'oportunidade', 'fechar']
};

/**
 * Detecta qual objeção é dominante no histórico.
 * Conta frequência e retorna a mais recorrente.
 */
function objecaoDominante(historicoObjecoes = [], objecaoAtual = null) {
  const todas = objecaoAtual
    ? [...historicoObjecoes, objecaoAtual]
    : historicoObjecoes;

  if (todas.length === 0) return null;

  const contagem = {};
  for (const o of todas) {
    if (o) contagem[o] = (contagem[o] || 0) + 1;
  }

  return Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/**
 * Determina em qual passo da sequência de tratamento estamos.
 * Usa a frequência da objeção no histórico como proxy do passo.
 */
function passoAtual(objecao, historicoObjecoes = []) {
  if (!objecao || !SEQUENCIAS[objecao]) return null;

  const frequencia = historicoObjecoes.filter(o => o === objecao).length;
  const sequencia = SEQUENCIAS[objecao];

  // Passo avança conforme a objeção se repete (cliente ainda não foi convencido)
  const idx = Math.min(frequencia, sequencia.length - 1);
  return sequencia[idx];
}

/**
 * Retorna dados completos para o engine e builder usarem.
 *
 * @param {string|null} objecaoAtual - objeção da mensagem atual
 * @param {string[]} historicoObjecoes - objections[] do conversation_state
 * @returns {{ dominante, passo, estrategia }}
 */
function analisarObjecao(objecaoAtual, historicoObjecoes = []) {
  const dominante = objecaoDominante(historicoObjecoes, objecaoAtual);
  const passo = passoAtual(dominante, [...historicoObjecoes, objecaoAtual].filter(Boolean));

  return {
    dominante,
    passo,
    temObjecaoAtiva: !!dominante
  };
}

module.exports = { analisarObjecao, SEQUENCIAS, objecaoDominante, passoAtual };
