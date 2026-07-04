/**
 * Estratégia: objeção de PREÇO
 * Sequência: valor → prova_social → garantia → parcelamento → fechar
 * Nunca: desconto automático, linguagem de "barato", comparação de preço com concorrente
 */

const instrucoes = {
  valor:
    'O cliente achou o preço alto. NÃO ofereça desconto. Mostre o VALOR: o que ele ganha (resultado, transformação, economia futura, tempo poupado). Use a linguagem "pelo preço de X você obtém Y" — nunca "é barato" ou "está em promoção".',

  prova_social:
    'O cliente ainda resiste ao preço. Mostre que outros compraram e aprovaram: mencione avaliações positivas, número de clientes, ou resultados que outros tiveram. Não invente — use apenas o que está na base de conhecimento.',

  garantia:
    'O cliente ainda hesita pelo preço. Reduza o risco percebido: destaque a garantia, política de devolução e o que acontece se não gostar. A mensagem é: "você não perde nada em tentar".',

  parcelamento:
    'O cliente ainda não se convenceu. Se o produto tem opção de parcelamento, apresente o valor por parcela — torna o preço psicologicamente menor. Se não há parcelamento, apresente o custo diário/mensal (ex: "R$ X por dia").',

  fechar:
    'Você já apresentou valor, prova social, garantia e facilidade de pagamento. Agora pergunte de forma direta e natural se o cliente está pronto para fechar. Exemplo: "Faz sentido pra você? Posso te mandar o link agora."'
};

function instrucao(passo) {
  return instrucoes[passo] || instrucoes.valor;
}

module.exports = { instrucao };
