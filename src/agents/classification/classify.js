const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

const INTENTS = [
  'greeting', 'price', 'discount', 'shipping', 'delivery', 'payment', 'pix',
  'installments', 'trust', 'guarantee', 'refund', 'comparison', 'availability',
  'technical_question', 'buy', 'checkout', 'complaint', 'angry', 'confused',
  'human_support', 'goodbye', 'smalltalk', 'unknown'
];

const OBJECTIONS = ['preco', 'confianca', 'entrega', 'garantia', 'qualidade', 'marca', 'necessidade', 'urgencia', null];

// Pesos de ajuste no buy score por intent detectado (aplicados pelo Buy Score Engine)
const BUY_SCORE_DELTA = {
  greeting: 0,
  price: 10,
  discount: -5,
  shipping: 15,
  delivery: 10,
  payment: 15,
  pix: 15,
  installments: 20,
  trust: 5,
  guarantee: 8,
  refund: -5,
  comparison: -5,
  availability: 10,
  technical_question: 5,
  buy: 30,
  checkout: 25,
  complaint: -20,
  angry: -25,
  confused: -5,
  human_support: 0,
  goodbye: -10,
  smalltalk: 0,
  unknown: 0
};

/**
 * Classifica a mensagem do cliente em intent/estágio/emoção/objeção.
 * Chamada curta e barata, separada da chamada principal de venda —
 * usa max_tokens baixo e não carrega o conhecimento do produto inteiro.
 */
async function classificar(mensagem, estadoAtual) {
  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `Você classifica mensagens de clientes em uma conversa de vendas via WhatsApp.
Responda APENAS com um JSON válido, sem texto antes ou depois, sem markdown.

Formato exato:
{
  "intent": "uma das opções: ${INTENTS.join(', ')}",
  "confidence": 0.0 a 1.0,
  "stage": "uma das opções: discovery, interest, comparison, objection, negotiation, ready_to_buy, checkout, after_sales",
  "emotion": "positive, neutral ou negative",
  "objection": "uma das opções: ${OBJECTIONS.filter(Boolean).join(', ')} ou null",
  "buyScoreDelta": número inteiro entre -30 e 30
}

Estágio atual da conversa: ${estadoAtual?.stage || 'discovery'}
Buy score atual: ${estadoAtual?.buy_score ?? 20}`,
    messages: [{ role: 'user', content: mensagem }]
  });

  const texto = resposta.content.find(c => c.type === 'text')?.text || '{}';

  try {
    const limpo = texto.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(limpo);

    // Aplica delta sugerido pela heurística fixa se a IA não sugerir nada coerente
    if (typeof parsed.buyScoreDelta !== 'number') {
      parsed.buyScoreDelta = BUY_SCORE_DELTA[parsed.intent] ?? 0;
    }

    return parsed;
  } catch (erro) {
    console.error('Falha ao parsear classificação:', texto);
    return { intent: 'unknown', confidence: 0, stage: estadoAtual?.stage || 'discovery', emotion: 'neutral', objection: null, buyScoreDelta: 0 };
  }
}

module.exports = { classificar, INTENTS, OBJECTIONS, BUY_SCORE_DELTA };
