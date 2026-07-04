/**
 * Customer Profile Classifier — Fase 2
 *
 * Classifica o perfil do cliente de forma determinística, sem chamada LLM extra.
 * Usa o estado da conversa + classificação atual para inferir o perfil.
 * O perfil muda o TOM da resposta no Prompt Builder — nunca o conteúdo factual.
 *
 * Perfis:
 *   sensivel_preco  — foca em custo-benefício e parcelamento
 *   desconfiado     — prioriza provas sociais e garantias
 *   decidido        — confirma e fecha rápido, sem enrolar
 *   analitico       — mais dados técnicos, comparações, fatos
 *   impulsivo       — CTA direto, mensagem curta, urgência leve
 *   curioso         — nutrir com informação, sem forçar venda
 *   neutro          — tom padrão de vendedor cordial
 */

const PERFIS = [
  'sensivel_preco', 'desconfiado', 'decidido',
  'analitico', 'impulsivo', 'curioso', 'neutro'
];

/**
 * Classifica o perfil a partir do estado atual e da última classificação.
 * Heurística em cascata — o primeiro match ganha.
 *
 * @param {object} estado - conversation_state do Supabase
 * @param {object} classificacao - resultado do classify.js
 * @returns {string} um dos valores de PERFIS
 */
function classificarPerfil(estado, classificacao) {
  const { buy_score = 20, messages_count = 0, objections = [] } = estado;
  const { intent, emotion } = classificacao;

  // Sensível a preço: já perguntou desconto OU objeção de preço registrada
  if (intent === 'discount' || objections.includes('preco')) {
    return 'sensivel_preco';
  }

  // Desconfiado: perguntou sobre confiança/marca, emoção negativa persistente,
  // ou objeção de confiança/marca no histórico
  if (
    intent === 'trust' ||
    objections.includes('confianca') ||
    objections.includes('marca') ||
    (emotion === 'negative' && messages_count > 3)
  ) {
    return 'desconfiado';
  }

  // Decidido: score alto com poucas mensagens (chegou pronto)
  if (buy_score >= 65 && messages_count <= 4) {
    return 'decidido';
  }

  // Impulsivo: score subiu rápido em poucas interações
  if (buy_score >= 55 && messages_count <= 3) {
    return 'impulsivo';
  }

  // Analítico: muitas mensagens, perguntas técnicas, score crescendo devagar
  if (messages_count >= 7 && intent === 'technical_question') {
    return 'analitico';
  }

  // Curioso mas frio: muitas mensagens e score ainda baixo
  if (messages_count >= 8 && buy_score < 35) {
    return 'curioso';
  }

  return 'neutro';
}

/**
 * Retorna a instrução de tom a ser injetada no Prompt Builder.
 * Curta — é um bloco dentro do system prompt, não o prompt inteiro.
 */
function instrucaoDeTom(perfil) {
  const instrucoes = {
    sensivel_preco:
      'O cliente é sensível a preço. Não ofereça desconto — mostre valor: o que ele GANHA pelo preço, o custo de NÃO comprar, e facilidades de pagamento se existirem. Nunca use linguagem de "promoção" ou "preço baixo".',
    desconfiado:
      'O cliente está desconfiado. Priorize provas sociais (avaliações, outros compradores), política de devolução clara, e garantia. Não apresse a venda — construa confiança primeiro. Seja transparente.',
    decidido:
      'O cliente está pronto para comprar. Seja direto: confirme os detalhes e conduza ao link de pagamento. Sem enrolação, sem informação extra que não pediu.',
    analitico:
      'O cliente é analítico. Responda com dados, especificações técnicas e comparações quando tiver. Seja preciso. Ele vai perguntar mais antes de decidir — é normal, não force a compra.',
    impulsivo:
      'O cliente é impulsivo. Mensagens muito curtas, CTA claro no final. Não sobrecarregue com informação — uma ou duas ideias fortes e o link. Urgência leve se fizer sentido.',
    curioso:
      'O cliente está curioso mas ainda frio. Nutra com informação de qualidade, não empurre venda. Perguntas abertas são bem-vindas para entender melhor o interesse dele.',
    neutro:
      'Tom de vendedor cordial e direto. Responda o que foi perguntado sem rodeios.'
  };
  return instrucoes[perfil] || instrucoes.neutro;
}

module.exports = { classificarPerfil, instrucaoDeTom, PERFIS };
