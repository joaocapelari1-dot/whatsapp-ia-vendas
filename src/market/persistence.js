const { supabase } = require('../../lib/supabase');
const { calcularOpportunityScore, normalizarComissao } = require('./opportunityScore');

/**
 * Persiste os produtos coletados: upsert em market_products + snapshot
 * diário em market_snapshots com os scores calculados.
 */
async function persistirColeta(produtos) {
  const hoje = new Date().toISOString().slice(0, 10);
  const resultados = [];

  for (const p of produtos) {
    if (!p.external_id || !p.nome) continue;

    // Upsert do produto
    const { data: produto, error } = await supabase
      .from('market_products')
      .upsert({
        plataforma: p.plataforma,
        external_id: p.external_id,
        nome: p.nome,
        categoria: p.categoria,
        preco: p.preco,
        comissao_pct: p.comissao_pct,
        comissao_valor: p.comissao_valor,
        temperatura: p.temperatura,
        url: p.url,
        ultimo_visto: new Date().toISOString()
      }, { onConflict: 'plataforma,external_id' })
      .select()
      .single();

    if (error) {
      console.error(`[market] Erro no upsert de ${p.nome}:`, error.message);
      continue;
    }

    // Calcula scores do dia
    const fatores = {
      commission: normalizarComissao(p.comissao_pct, p.comissao_valor),
      temperature: p.temperatura != null ? Math.min(100, Number(p.temperatura)) : null,
      trend: p.trend_score ?? null,
      competition: null, // v1: sem dado confiável ainda — entra no confidence
      landing: null      // v1: avaliação de landing fica pra iteração seguinte
    };

    const { opportunityScore, confidenceScore, detalhes } = calcularOpportunityScore(fatores);

    // Snapshot do dia (upsert pra rodadas repetidas no mesmo dia)
    await supabase.from('market_snapshots').upsert({
      product_id: produto.id,
      data: hoje,
      opportunity_score: opportunityScore,
      confidence_score: confidenceScore,
      trend_score: detalhes.trend,
      commission_score: detalhes.commission,
      competition_score: detalhes.competition,
      landing_score: detalhes.landing,
      raw: p
    }, { onConflict: 'product_id,data' });

    resultados.push({ ...produto, opportunityScore, confidenceScore });
  }

  return resultados;
}

/**
 * Detecta movimento: compara o snapshot de hoje com o mais recente anterior.
 * Retorna { subiram, cairam, novos }.
 */
async function detectarMovimento(produtosDeHoje) {
  const hoje = new Date().toISOString().slice(0, 10);
  const subiram = [];
  const cairam = [];
  const novos = [];

  for (const p of produtosDeHoje) {
    const { data: snapshots } = await supabase
      .from('market_snapshots')
      .select('data, opportunity_score')
      .eq('product_id', p.id)
      .lt('data', hoje)
      .order('data', { ascending: false })
      .limit(1);

    const anterior = snapshots?.[0];

    if (!anterior) {
      novos.push(p);
      continue;
    }

    const delta = p.opportunityScore - Number(anterior.opportunity_score ?? 0);
    if (delta >= 8) subiram.push({ ...p, delta });
    if (delta <= -8) cairam.push({ ...p, delta });
  }

  return { subiram, cairam, novos };
}

module.exports = { persistirColeta, detectarMovimento };
