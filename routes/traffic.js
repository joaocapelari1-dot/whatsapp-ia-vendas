const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { analisarLanding } = require('../src/traffic/landingAnalyzer');
const { gerarPlanoTrafego, formatarPlanoTelegram } = require('../src/traffic/planner');
const { enviarTelegram } = require('../src/market/telegram');

/**
 * POST /traffic/gerar { "codigo": "PX01" }
 * Gera o plano de tráfego completo pra um produto já importado no Sales
 * Brain: analisa a landing + monta plano (audiência, persona, copies,
 * Meta Ads Assistant), salva e envia resumo no Telegram.
 */
router.post('/traffic/gerar', async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'codigo é obrigatório' });

    const { data: produto } = await supabase
      .from('produtos')
      .select('*')
      .eq('codigo', codigo)
      .single();

    if (!produto) return res.status(404).json({ erro: `Produto ${codigo} não encontrado` });
    if (produto.status !== 'pronto') {
      return res.status(400).json({ erro: `Produto ainda está "${produto.status}" — aguarde a importação concluir` });
    }

    res.json({ status: 'gerando', codigo }); // responde já — o processo leva ~1-2 min

    // Pipeline assíncrono
    (async () => {
      const landing = produto.url_origem ? await analisarLanding(produto.url_origem) : null;
      const plano = await gerarPlanoTrafego({ produto, landing });

      await supabase.from('traffic_plans').upsert({
        product_id: produto.id,
        landing_score: landing?.landingScore ?? null,
        landing_detalhes: landing,
        plano,
        criado_em: new Date().toISOString()
      }, { onConflict: 'product_id' });

      await enviarTelegram(formatarPlanoTelegram(produto, plano, landing));
    })().catch(erro => console.error('[traffic] Erro no pipeline:', erro));
  } catch (erro) {
    console.error('[traffic] Erro:', erro);
    res.status(500).json({ erro: erro.message });
  }
});

/**
 * GET /traffic/plano/:codigo
 * Retorna o plano completo em JSON (copies A/B, persona, keywords,
 * configuração Meta Ads pronta pra copiar).
 */
router.get('/traffic/plano/:codigo', async (req, res) => {
  const { data: produto } = await supabase
    .from('produtos')
    .select('id, nome, codigo')
    .eq('codigo', req.params.codigo)
    .single();

  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

  const { data: plano } = await supabase
    .from('traffic_plans')
    .select('*')
    .eq('product_id', produto.id)
    .single();

  if (!plano) return res.status(404).json({ erro: 'Plano ainda não gerado — use POST /traffic/gerar' });

  res.json({ produto: produto.nome, ...plano });
});

module.exports = router;
