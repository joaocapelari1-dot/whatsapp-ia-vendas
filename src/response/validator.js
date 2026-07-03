// Frases que nunca deveriam aparecer numa resposta de "vendedor humano"
const FRASES_PROIBIDAS = [
  /sou (uma |um )?(ia|intelig[eê]ncia artificial|assistente virtual|modelo de linguagem)/i,
  /n[aã]o posso (te )?ajudar com isso/i,
  /meu prompt/i,
  /minhas instru[cç][oõ]es/i,
  /system prompt/i
];

/**
 * Valida a resposta gerada pelo LLM antes de enviar ao cliente.
 * Retorna { valido: boolean, motivo?: string }.
 */
function validarResposta(texto, { produto } = {}) {
  if (!texto || !texto.trim()) {
    return { valido: false, motivo: 'resposta_vazia' };
  }

  for (const padrao of FRASES_PROIBIDAS) {
    if (padrao.test(texto)) {
      return { valido: false, motivo: `frase_proibida: ${padrao}` };
    }
  }

  // Checagem simples de preço: se a IA mencionar um valor em R$ diferente
  // do preço real do produto, sinaliza pra revisão (heurística, não é 100%)
  if (produto?.preco) {
    const precosNoTexto = [...texto.matchAll(/R\$\s?([\d.,]+)/g)]
      .map(m => parseFloat(m[1].replace('.', '').replace(',', '.')));

    const precoReal = Number(produto.preco);
    const precoDivergente = precosNoTexto.some(
      p => Math.abs(p - precoReal) > precoReal * 0.05 // tolerância de 5%
    );

    if (precoDivergente) {
      return { valido: false, motivo: `preco_divergente: mencionou ${precosNoTexto} vs real ${precoReal}` };
    }
  }

  return { valido: true };
}

module.exports = { validarResposta };
