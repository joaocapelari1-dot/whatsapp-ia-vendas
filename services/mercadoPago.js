const mercadopago = require('mercadopago');

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

async function gerarLinkPagamento(produto, lead) {
  const preference = await mercadopago.preferences.create({
    items: [
      {
        title: produto.nome || 'Produto',
        unit_price: Number(produto.preco) || 0,
        quantity: 1
      }
    ],
    external_reference: `${lead.id}_${produto.id}`,
    notification_url: `${process.env.BACKEND_URL}/webhook/mercadopago`
  });

  return preference.body.init_point;
}

module.exports = { gerarLinkPagamento };
