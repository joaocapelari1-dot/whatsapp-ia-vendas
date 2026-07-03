const { supabase } = require('../../lib/supabase');

/**
 * Registra o rastro completo de uma decisão — permite auditar depois
 * qualquer conversa: o que foi classificado, que estratégia foi escolhida,
 * e por quê.
 */
async function registrarDecisao({ leadId, produtoId, mensagemRecebida, classificacao, estrategia, motivoEstrategia, respostaGerada, validacao }) {
  try {
    await supabase.from('decision_logs').insert({
      lead_id: leadId,
      product_id: produtoId || null,
      mensagem_recebida: mensagemRecebida,
      intent: classificacao?.intent,
      confidence: classificacao?.confidence,
      stage: classificacao?.stage,
      emotion: classificacao?.emotion,
      objection: classificacao?.objection,
      buy_score_delta: classificacao?.buyScoreDelta,
      estrategia,
      motivo_estrategia: motivoEstrategia,
      resposta_gerada: respostaGerada,
      resposta_valida: validacao?.valido,
      motivo_invalidacao: validacao?.motivo || null
    });
  } catch (erro) {
    // Log nunca deve derrubar o fluxo principal de atendimento
    console.error('Falha ao registrar decision log:', erro.message);
  }
}

module.exports = { registrarDecisao };
