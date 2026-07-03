const MIN_SCORE = 0;
const MAX_SCORE = 100;

/**
 * Calcula o novo buy score a partir do score atual + delta do evento.
 * Função pura — não faz IO, só matemática. Facilita testar e ajustar pesos
 * sem tocar no resto do sistema.
 */
function calcularNovoScore(scoreAtual, delta) {
  const novo = (scoreAtual ?? 20) + (delta ?? 0);
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, novo));
}

/**
 * Decaimento por inatividade — chamar isso num cron job (ex: 1x por dia)
 * pra esfriar leads que sumiram, conforme a regra "3 dias sem responder -30".
 */
function aplicarDecaimentoPorInatividade(scoreAtual, diasSemResposta) {
  if (diasSemResposta >= 7) return calcularNovoScore(scoreAtual, -40);
  if (diasSemResposta >= 3) return calcularNovoScore(scoreAtual, -30);
  return scoreAtual;
}

// Limiares usados pelo Decision Engine
const LIMIAR_CHECKOUT = 70;
const LIMIAR_OBJECAO_ATIVA = 40; // abaixo disso, prioriza reconstruir confiança antes de vender

module.exports = {
  calcularNovoScore,
  aplicarDecaimentoPorInatividade,
  LIMIAR_CHECKOUT,
  LIMIAR_OBJECAO_ATIVA
};
