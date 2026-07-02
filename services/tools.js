const tools = [
  {
    name: 'gerar_link_pagamento',
    description: 'Gera um link de pagamento para o cliente finalizar a compra. Use apenas quando o cliente demonstrar intenção clara de comprar.',
    input_schema: {
      type: 'object',
      properties: {
        confirmacao: {
          type: 'boolean',
          description: 'true se o cliente confirmou verbalmente que quer comprar'
        }
      },
      required: ['confirmacao']
    }
  },
  {
    name: 'escalar_humano',
    description: 'Sinaliza que a conversa precisa de atendimento humano (reclamação, dúvida fora do escopo, problema pós-venda).',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Breve motivo da escalação' }
      },
      required: ['motivo']
    },
    // cache_control no último bloco cacheia tudo que vem antes dele também
    // (regras + conhecimento do produto + estas tools), num único bloco de cache.
    cache_control: { type: 'ephemeral' }
  }
];

module.exports = { tools };
