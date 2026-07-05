const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

/**
 * ENRICHMENT + MARKET DNA (módulos fundidos — os campos se sobrepõem ~80%).
 * Gera o perfil estratégico do produto numa ÚNICA chamada de IA, consumido
 * depois pelo Sales Brain (avatar, dores, objeções) e pelo Traffic Brain
 * (nicho, sazonalidade, viralização).
 *
 * CONTROLE DE CUSTO: aplicado apenas ao TOP N por Opportunity Score
 * (padrão 15, configurável via DNA_TOP_N). Produto de score baixo não
 * merece token.
 */
async function gerarMarketDNA(produto) {
  try {
    const resposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: `Você analisa produtos de afiliado do mercado digital brasileiro. Com base no título, categoria, preço e comissão, gere o DNA estratégico do produto. Responda APENAS JSON válido:
{
  "nicho": "...",
  "tipoProduto": "curso|ebook|mentoria|software|fisico|assinatura|outro",
  "avatarComprador": "descrição curta de quem compra",
  "dores": ["...", "..."],
  "desejos": ["...", "..."],
  "beneficios": ["...", "..."],
  "objecoes": ["...", "..."],
  "palavrasChave": ["...", "..."],
  "impulsoCompra": 0-100,
  "urgencia": 0-100,
  "intensidadeDor": 0-100,
  "recorrencia": true|false,
  "sazonalidade": "nenhuma|descrição curta",
  "evergreen": true|false,
  "escalabilidade": 0-100,
  "potencialViralizacao": 0-100,
  "dificuldadeVenda": 0-100,
  "confiancaAnalise": "baixa|media|alta"
}
Marque confiancaAnalise como "baixa" quando só o título estiver disponível — a análise é inferência, não dado.`,
      messages: [{
        role: 'user',
        content: JSON.stringify({
          titulo: produto.title,
          categoria: produto.category,
          preco: produto.price,
          comissaoPct: produto.commissionPct,
          plataforma: produto.platform
        })
      }]
    });

    const texto = resposta.content.find(c => c.type === 'text')?.text || '{}';
    return JSON.parse(texto.replace(/```json|```/g, '').trim());
  } catch (erro) {
    console.warn(`[market] DNA indisponível para "${produto.title}": ${erro.message}`);
    return null;
  }
}

/**
 * Enriquece o top N produtos (já ordenados por score) com Market DNA,
 * em série pra não estourar rate limit.
 */
async function enriquecerTopProdutos(produtosOrdenados) {
  const topN = Number(process.env.DNA_TOP_N ?? 15);
  const alvo = produtosOrdenados.slice(0, topN);

  for (const produto of alvo) {
    produto.dna = await gerarMarketDNA(produto);
  }

  console.log(`[market] Market DNA gerado para ${alvo.filter(p => p.dna).length}/${alvo.length} produtos (top ${topN})`);
  return produtosOrdenados;
}

module.exports = { gerarMarketDNA, enriquecerTopProdutos };
