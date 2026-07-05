const { supabase } = require('../../lib/supabase');
const { calcularOpportunityScore, normalizarComissao } = require('./opportunityScore');
const { multiplicadorFonte } = require('./quality');

/**
 * Persiste produtos canônicos: upsert em market_products + snapshot diário.
 * O Opportunity Score recebe o multiplicador do Source Score da plataforma.
 */
async function persistirColeta(produtos) {
  const hoje = new Date().toISOString().slice(0, 10);
  const resultados = [];

  for (const p of produtos) {
    if (!p.externalId || !p.title) continue;

    const { data: produto, error } = await supabase
      .from('market_products')
      .upsert({
        plataforma: p.platform,
        external_id: p.externalId,
        nome: p.title,
        categoria: p.category,
        preco: p.price,
        comissao_pct: p.commissionPct,
        comissao_valor: p.commissionValue,
        temperatura: p.temperature,
        url: p.url,
        fingerprint: p.fingerprint,
        ultimo_visto: new Date().toISOString()
      }, { onConflict: 'plataforma,external_id' })
      .select()
      .single();

    if (error) {
      console.error(`[market] Erro no upsert de ${p.title}:`, error.message);
      continue;
    }

    const fatores = {
      commission: normalizarComissao(p.commissionPct, p.commissionValue),
      temperature: p.temperature != null ? Math.min(100, Number(p.temperature)) : null,
      trend: p.trend_score ?? null,
      competition: null,
      landing: null
    };

    const { opportunityScore, confidenceScore, detalhes } = calcularOpportunityScore(fatores);

    // Source Score modula o resultado final (efeito suave, 0.8x a 1.0x)
    const scoreFinal = Math.round(opportunityScore * multiplicadorFonte(p.platform));

    await supabase.from('market_snapshots').upsert({
      product_id: produto.id,
      data: hoje,
      opportunity_score: scoreFinal,
      confidence_score: confidenceScore,
      trend_score: detalhes.trend,
      commission_score: detalhes.commission,
      competition_score: detalhes.competition,
      landing_score: detalhes.landing,
      raw: p
    }, { onConflict: 'product_id,data' });

    resultados.push({ ...p, id: produto.id, opportunityScore: scoreFinal, confidenceScore });
  }

  return resultados;
}

/**
 * Salva o Market DNA gerado pelo enrichment (segunda passada, só top N).
 */
async function salvarDNA(produtos) {
  for (const p of produtos) {
    if (!p.dna || !p.id) continue;
    await supabase
      .from('market_products')
      .update({ dna: p.dna })
      .eq('id', p.id);
  }
}

/**
 * Detecta movimento: compara o snapshot de hoje com o mais recente anterior.
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

module.exports = { persistirColeta, salvarDNA, detectarMovimento };
