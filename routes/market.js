const express = require('express');
const router = express.Router();
const { rodarAnaliseDiaria } = require('../src/market/scheduler');
const { processarComandoTelegram } = require('../src/market/telegram');
const { supabase } = require('../lib/supabase');

// Webhook do Telegram (configurar via setWebhook apontando pra cá)
router.post('/webhook/telegram', async (req, res) => {
  try {
    await processarComandoTelegram(req.body);
  } catch (erro) {
    console.error('[market] Erro no comando Telegram:', erro.message);
  }
  res.sendStatus(200);
});

// Disparo manual da análise (útil pra testar sem esperar o cron)
router.post('/market/rodar', async (req, res) => {
  res.json({ status: 'iniciado' }); // responde já — a análise leva minutos
  rodarAnaliseDiaria().catch(erro =>
    console.error('[market] Erro na análise manual:', erro)
  );
});

// Top produtos atuais (consulta rápida)
router.get('/market/top', async (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('market_snapshots')
    .select('opportunity_score, confidence_score, market_products(nome, plataforma, comissao_pct, preco, url, importado)')
    .eq('data', hoje)
    .order('opportunity_score', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

module.exports = router;
