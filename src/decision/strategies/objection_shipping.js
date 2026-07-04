/**
 * Estratégia: objeção de ENTREGA / PRAZO
 * Sequência: prazo_concreto → experiencia_outros → garantia → fechar
 */

const instrucoes = {
  prazo_concreto:
    'O cliente está preocupado com prazo de entrega. Informe o prazo concreto com base na base de conhecimento. Se o produto for digital, destaque o acesso imediato. Seja específico — "em média X dias úteis" é melhor que "rápido".',

  experiencia_outros:
    'O cliente ainda tem dúvida sobre entrega. Reforce com experiência de outros compradores: menção a entregas no prazo, relatos positivos, ou casos de clientes satisfeitos com a rapidez.',

  garantia:
    'O cliente ainda hesita por causa da entrega. Mencione que o produto tem garantia: se não chegar no prazo ou vier com problema, ele tem cobertura. Isso reduz o risco percebido da entrega.',

  fechar:
    'Abordou prazo, experiências e garantia. Pergunte se o cliente está confortável para prosseguir. Exemplo: "Assim ficou mais claro? Posso te passar o link?"'
};

function instrucao(passo) {
  return instrucoes[passo] || instrucoes.prazo_concreto;
}

module.exports = { instrucao };
