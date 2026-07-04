const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

/**
 * Endpoints de agregação pro dashboard. Só leitura de dados já persistidos —
 * nenhuma chamada de IA aqui (custo zero de tokens por visualização).
 */

// GET /dashboard/resumo — visão geral dos três cérebros
router.get('/dashboard/resumo', async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);

    const [estados, leadsEscalados, conversasHoje, checkouts, radarHoje, planosTrafego] = await Promise.all([
      supabase.from('conversation_state').select('stage, buy_score'),
      supabase.from('leads').select('id, telefone, atualizado_em').eq('status_funil', 'escalado'),
      supabase.from('conversas').select('id', { count: 'exact', head: true }).gte('criado_em', `${hoje}T00:00:00`),
      supabase.from('vendas').select('id, criado_em, produto_id'),
      supabase.from('market_snapshots').select('id', { count: 'exact', head: true }).eq('data', hoje),
      supabase.from('traffic_plans').select('id', { count: 'exact', head: true })
    ]);

    const porEstagio = {};
    let somaScore = 0;
    for (const e of estados.data || []) {
      porEstagio[e.stage] = (porEstagio[e.stage] || 0) + 1;
      somaScore += e.buy_score || 0;
    }
    const totalConversas = (estados.data || []).length;

    const checkoutsHoje = (checkouts.data || []).filter(v => v.criado_em?.startsWith(hoje)).length;

    res.json({
      funil: {
        porEstagio,
        totalConversas,
        buyScoreMedio: totalConversas ? Math.round(somaScore / totalConversas) : 0,
        mensagensHoje: conversasHoje.count || 0
      },
      atencao: {
        leadsEscalados: (leadsEscalados.data || []).map(l => ({
          telefone: mascarar(l.telefone),
          desde: l.atualizado_em
        }))
      },
      radar: { produtosAnalisadosHoje: radarHoje.count || 0 },
      trafego: { planosGerados: planosTrafego.count || 0 },
      vendas: { checkoutsHoje, checkoutsTotal: (checkouts.data || []).length }
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// GET /dashboard/radar — top produtos do dia com links
router.get('/dashboard/radar', async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('market_snapshots')
      .select('opportunity_score, confidence_score, trend_score, commission_score, market_products(id, nome, plataforma, categoria, preco, comissao_pct, url, external_id, importado)')
      .eq('data', hoje)
      .order('opportunity_score', { ascending: false })
      .limit(20);

    if (error) throw error;

    const numeroWpp = process.env.EVOLUTION_INSTANCE_PHONE || null;

    const itens = (data || []).map(s => {
      const p = s.market_products;
      const codigoSales = p?.importado ? `MKT${p.external_id}`.slice(0, 20) : null;
      return {
        nome: p?.nome,
        plataforma: p?.plataforma,
        categoria: p?.categoria,
        preco: p?.preco,
        comissaoPct: p?.comissao_pct,
        score: Number(s.opportunity_score),
        confidence: Number(s.confidence_score),
        trend: s.trend_score != null ? Number(s.trend_score) : null,
        linkPagina: p?.url || null, // link da página de vendas pra conferir o produto
        importado: !!p?.importado,
        codigoImportacao: `${(p?.plataforma || '').toUpperCase()}_${p?.external_id}`,
        linkWhatsapp: codigoSales && numeroWpp
          ? `https://wa.me/${numeroWpp}?text=${encodeURIComponent(`Quero saber sobre #${codigoSales}`)}`
          : null
      };
    });

    res.json(itens);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// GET /dashboard/trafego — planos de tráfego gerados
router.get('/dashboard/trafego', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('traffic_plans')
      .select('landing_score, criado_em, plano, produtos(nome, codigo)')
      .order('criado_em', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json((data || []).map(t => ({
      produto: t.produtos?.nome,
      codigo: t.produtos?.codigo,
      landingScore: t.landing_score != null ? Number(t.landing_score) : null,
      canalPrincipal: t.plano?.canais?.[0]?.canal || null,
      orcamentoDiario: t.plano?.orcamento?.inicialDiario || null,
      geradoEm: t.criado_em
    })));
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// GET /dashboard/vendas — checkouts por dia (últimos 14 dias) e por produto
router.get('/dashboard/vendas', async (req, res) => {
  try {
    const inicio = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('vendas')
      .select('criado_em, produtos(nome)')
      .gte('criado_em', inicio)
      .order('criado_em', { ascending: true });

    if (error) throw error;

    const porDia = {};
    const porProduto = {};
    for (const v of data || []) {
      const dia = v.criado_em.slice(0, 10);
      porDia[dia] = (porDia[dia] || 0) + 1;
      const nome = v.produtos?.nome || 'Sem produto';
      porProduto[nome] = (porProduto[nome] || 0) + 1;
    }

    res.json({ porDia, porProduto });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

function mascarar(telefone) {
  if (!telefone) return '';
  return telefone.slice(0, -4).replace(/\d/g, '•') + telefone.slice(-4);
}

module.exports = router;
