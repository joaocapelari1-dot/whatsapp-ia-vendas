/**
 * Estratégia: objeção de CONFIANÇA / MARCA
 * Sequência: prova_social → garantia → transparencia → fechar
 * Foco: nunca pressionar, deixar o cliente chegar às próprias conclusões
 */

const instrucoes = {
  prova_social:
    'O cliente está desconfiado. Apresente evidências de que outros compraram e ficaram satisfeitos: avaliações, número de clientes, tempo de mercado. Não exagere nem invente — use só o que está na base de conhecimento.',

  garantia:
    'O cliente ainda desconfia. Destaque a garantia e política de devolução de forma clara. A mensagem é: "se não gostar, você tem proteção" — isso remove o risco percebido.',

  transparencia:
    'O cliente precisa de mais transparência. Seja claro sobre como funciona o produto, quem está por trás, e como o suporte funciona. Responda de forma direta qualquer dúvida sobre o processo de compra.',

  fechar:
    'O cliente já recebeu provas sociais, garantia e informações transparentes. Pergunte de forma não-invasiva se tem mais alguma dúvida antes de prosseguir. Exemplo: "Alguma outra dúvida antes de te mandar o link?"'
};

function instrucao(passo) {
  return instrucoes[passo] || instrucoes.prova_social;
}

module.exports = { instrucao };
