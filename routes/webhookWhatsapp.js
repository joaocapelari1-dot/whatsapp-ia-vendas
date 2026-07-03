const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { extrairDadosEvolution } = require('../services/evolutionApi');
const { processarMensagem } = require('../src/salesBrain');

router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { telefone, mensagem } = extrairDadosEvolution(req.body);

    if (!telefone || !mensagem) {
      return res.sendStatus(200); // evento irrelevante (ex: status de leitura)
    }

    let { data: lead } = await supabase
      .from('leads')
      .select('*, produto_atual:produtos(*)')
      .eq('telefone', telefone)
      .single();

    if (!lead) {
      // Extrai código do produto da mensagem inicial (ex: "Quero saber sobre #PX01")
      const match = mensagem.match(/#(\w+)/);
      const codigo = match ? match[1] : null;

      let produtoEncontrado = null;
      if (codigo) {
        const { data: produto } = await supabase
          .from('produtos')
          .select('*')
          .eq('codigo', codigo)
          .single();
        produtoEncontrado = produto;
      }

      const { data: novoLead } = await supabase
        .from('leads')
        .insert({ telefone, produto_atual_id: produtoEncontrado?.id || null })
        .select('*, produto_atual:produtos(*)')
        .single();

      lead = novoLead;
    }

    const produto = lead.produto_atual || null;

    await processarMensagem(lead, mensagem, produto);
    res.sendStatus(200);
  } catch (erro) {
    console.error('Erro no webhook WhatsApp:', erro);
    res.sendStatus(500);
  }
});

module.exports = router;
