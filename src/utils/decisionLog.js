const { supabase } = require('../../lib/supabase');

/**
 * Registra o rastro completo de uma decisão.
 * Fase 2: inclui perfil do cliente, objeção dominante e passo atual.
 */
async function registrarDecisao({
  leadId, produtoId, mensagemRecebida, classificacao,
  perfil, objecaoDominante, passo,
  estrategia, motivoEstrategia, respostaGerada, validacao
}) {
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
      // Fase 2
      perfil_cliente: perfil || null,
      objecao_dominante: objecaoDominante || null,
      passo_objecao: passo || null,
      estrategia,
      motivo_estrategia: motivoEstrategia,
      resposta_gerada: respostaGerada,
      resposta_valida: validacao?.valido,
      motivo_invalidacao: validacao?.motivo || null
    });
  } catch (erro) {
    console.error('Falha ao registrar decision log:', erro.message);
  }
}

module.exports = { registrarDecisao };
