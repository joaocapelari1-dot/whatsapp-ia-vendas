const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { importarProduto } = require('../services/importarProduto');

// POST /produtos/importar  { "url": "...", "codigo": "PX01" }
router.post('/produtos/importar', async (req, res) => {
  try {
    const { url, codigo } = req.body;

    if (!url || !codigo) {
      return res.status(400).json({ erro: 'url e codigo são obrigatórios' });
    }

    const produto = await importarProduto(url, codigo);

    // Gera automaticamente o link de clique-para-chat pronto pra usar na página de vendas
    const numeroWpp = process.env.EVOLUTION_INSTANCE_PHONE || 'SEUNUMERO';
    const linkWhatsapp = `https://wa.me/${numeroWpp}?text=${encodeURIComponent(`Quero saber sobre #${codigo}`)}`;

    res.json({ produto, linkWhatsapp });
  } catch (erro) {
    console.error('Erro ao importar produto:', erro);
    res.status(500).json({ erro: 'Falha ao importar produto', detalhe: erro.message });
  }
});

// GET /produtos  -> lista todos, útil pra conferir status
router.get('/produtos', async (req, res) => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

module.exports = router;
