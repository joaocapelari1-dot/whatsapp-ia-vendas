/**
 * Estratégia: objeção de QUALIDADE / NECESSIDADE / MARCA
 * Sequência: evidencias → avaliacoes → garantia → fechar
 */

const instrucoes = {
  evidencias:
    'O cliente duvida da qualidade. Apresente evidências objetivas: materiais, especificações, certificações, ingredientes, processo de produção — o que estiver na base de conhecimento. Fatos, não adjetivos.',

  avaliacoes:
    'O cliente ainda não está convencido da qualidade. Mostre avaliações e resultados de outros compradores. Dados concretos: nota média, número de avaliações, depoimentos reais. Não invente.',

  garantia:
    'O cliente ainda tem dúvida de qualidade. Posicione a garantia como prova de confiança do vendedor no produto: "se a qualidade não corresponder ao que prometemos, devolvemos".',

  fechar:
    'Qualidade foi demonstrada com evidências, avaliações e garantia. Pergunte diretamente se o cliente quer experimentar. Exemplo: "Com a garantia, não tem risco. Quer que eu te mande o link?"'
};

function instrucao(passo) {
  return instrucoes[passo] || instrucoes.evidencias;
}

module.exports = { instrucao };
