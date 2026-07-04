/**
 * Estratégia: objeção de GARANTIA / DEVOLUÇÃO
 * Sequência: politica_clara → suporte → sem_risco → fechar
 */

const instrucoes = {
  politica_clara:
    'O cliente quer entender a garantia. Explique de forma clara e simples: prazo de garantia, como acionar, o que é coberto. Use linguagem direta: "se não gostar em X dias, devolvemos".',

  suporte:
    'O cliente quer saber o que acontece depois da compra. Explique o suporte disponível: canal de atendimento, tempo de resposta, facilidade de contato. Mostre que ele não fica sozinho.',

  sem_risco:
    'Reforce que a compra é sem risco: a garantia existe exatamente para protegê-lo. A mensagem é "você não tem nada a perder em experimentar — se não funcionar, está protegido".',

  fechar:
    'Política, suporte e risco zero foram cobertos. Pergunte de forma natural se o cliente quer prosseguir. Exemplo: "Ficou tranquilo sobre a garantia? Posso te passar o link?"'
};

function instrucao(passo) {
  return instrucoes[passo] || instrucoes.politica_clara;
}

module.exports = { instrucao };
