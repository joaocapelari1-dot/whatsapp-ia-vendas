// Usando link de afiliado direto (sem Mercado Pago)
async function gerarLinkPagamento(produto, lead) {
    const link = produto.link_pagamento_base || produto.link_afiliado || '#';
    return link;
}

module.exports = { gerarLinkPagamento };
