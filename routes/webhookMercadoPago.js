const express = require('express');
const router = express.Router();
const mercadopago = require('mercadopago');
const { supabase } = require('../lib/supabase');
const { enviarMensagemWhatsapp } = require('../services/evolutionApi');

router.post('/webhook/mercadopago', async (req, res) => {
  const { type, data } = req.body;

  if (type !== 'payment') {
    return res.sendStatus(200); // ignora outros tipos de evento
  }

  try {
    const pagamento = await mercadopago.payment.findById(data.id);
    const { status, external_reference } = pagamento.body;

    const [leadId, produtoId] = external_reference.split('_');

    await supabase
      .from('vendas')
      .update({
        status_pagamento: status, // approved | pending | rejected
        mp_payment_id: String(data.id)
      })
      .eq('lead_id', leadId)
      .eq('produto_id', produtoId);

    if (status === 'approved') {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
      const { data: produto } = await supabase.from('produtos').select('*').eq('id', produtoId).single();

      const mensagemConfirmacao = `Pagamento confirmado! 🎉 Muito obrigado pela compra do ${produto.nome}. ` +
        (produto.link_entrega
          ? `Aqui está seu acesso: ${produto.link_entrega}`
          : `Em instantes você recebe as instruções de acesso.`);

      await enviarMensagemWhatsapp(lead.telefone, mensagemConfirmacao);

      await supabase.from('conversas').insert({
        lead_id: leadId,
        produto_id: produtoId,
        remetente: 'ia',
        mensagem: mensagemConfirmacao
      });

      await supabase.from('leads').update({ status_funil: 'comprou' }).eq('id', leadId);
    }

    if (status === 'rejected') {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
      const msg = 'Percebi que o pagamento não foi aprovado. Quer tentar novamente ou prefere outra forma de pagamento?';
      await enviarMensagemWhatsapp(lead.telefone, msg);
      await supabase.from('conversas').insert({
        lead_id: leadId,
        produto_id: produtoId,
        remetente: 'ia',
        mensagem: msg
      });
    }

    res.sendStatus(200);
  } catch (erro) {
    console.error('Erro webhook MP:', erro);
    res.sendStatus(500);
  }
});

module.exports = router;
