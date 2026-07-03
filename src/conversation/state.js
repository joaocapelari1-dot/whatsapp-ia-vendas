const { supabase } = require('../../lib/supabase');

/**
 * Busca (ou cria) o estado de uma conversa. Nunca decidimos olhando só o
 * histórico bruto de mensagens — este registro é a "memória de trabalho"
 * daquela conversa.
 */
async function buscarOuCriarEstado(leadId, produtoId) {
  const { data: existente } = await supabase
    .from('conversation_state')
    .select('*')
    .eq('lead_id', leadId)
    .single();

  if (existente) return existente;

  const { data: novo, error } = await supabase
    .from('conversation_state')
    .insert({
      lead_id: leadId,
      product_id: produtoId || null,
      stage: 'discovery',
      buy_score: 20,
      objections: [],
      last_questions: [],
      sentiment: 'neutral'
    })
    .select()
    .single();

  if (error) throw error;
  return novo;
}

/**
 * Atualiza o estado após processar uma mensagem. Recebe o estado atual e um
 * patch parcial (o que mudou), nunca sobrescreve o registro inteiro.
 */
async function atualizarEstado(leadId, patch) {
  const { data, error } = await supabase
    .from('conversation_state')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Acrescenta um item a um campo array (objections, last_questions) sem
 * duplicar e mantendo só os N mais recentes.
 */
function acrescentarLimitado(arrayAtual, novoItem, limite = 10) {
  const atual = Array.isArray(arrayAtual) ? arrayAtual : [];
  if (novoItem == null) return atual;
  const atualizado = [...atual, novoItem].slice(-limite);
  return atualizado;
}

module.exports = { buscarOuCriarEstado, atualizarEstado, acrescentarLimitado };
