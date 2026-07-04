const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

/**
 * Traffic Planner v1: recebe o conhecimento do produto (já extraído pelo
 * Sales Brain) + análise da landing, e gera o plano completo de tráfego
 * em UMA chamada estruturada: audiência, persona, canais, orçamento,
 * criativos, copies A/B e o resumo Meta Ads Assistant.
 *
 * Princípio da casa: o LLM estrutura recomendações a partir de dados reais
 * do produto — e SEMPRE declara o nível de confiança e a fonte (estimativa
 * vs. dado real), sem prometer configuração "perfeita".
 */
async function gerarPlanoTrafego({ produto, landing }) {
  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: `Você é um estrategista de mídia paga sênior especializado em produtos digitais/afiliados no Brasil.
Gere um plano de tráfego completo. Responda APENAS JSON válido, sem markdown, no formato:

{
  "audiencia": {
    "faixaEtaria": "...",
    "genero": "...",
    "interesses": ["..."],
    "comportamentos": ["..."],
    "nivelConsciencia": "inconsciente|problema|solucao|produto",
    "confianca": "estimativa baseada no produto — validar com dados reais de campanha"
  },
  "persona": {
    "nome": "...", "idade": 0, "profissao": "...",
    "dores": ["..."], "objetivos": ["..."], "objecoes": ["..."], "canaisPreferidos": ["..."]
  },
  "canais": [
    {"canal": "Meta Ads", "score": 0-100, "motivo": "..."},
    {"canal": "Google Ads", "score": 0-100, "motivo": "..."},
    {"canal": "TikTok Ads", "score": 0-100, "motivo": "..."}
  ],
  "objetivoCampanha": "Mensagens WhatsApp|Conversões|Leads|Tráfego",
  "orcamento": {
    "inicialDiario": 0,
    "regraEscala": "...",
    "observacao": "valores iniciais conservadores — ajustar com dados reais"
  },
  "criativos": {
    "formatoRecomendado": "...",
    "quantidade": 0,
    "ganchos": ["...", "...", "..."]
  },
  "copies": [
    {"versao": "A", "headline": "...", "textoPrincipal": "...", "cta": "..."},
    {"versao": "B", "headline": "...", "textoPrincipal": "...", "cta": "..."}
  ],
  "keywords": ["..."],
  "metaAdsAssistant": {
    "nomeCampanha": "...",
    "objetivo": "...",
    "orcamentoDiario": 0,
    "segmentacao": {"idade": "...", "interesses": ["..."], "posicionamentos": ["..."]},
    "kpisEsperados": {"ctrMinimo": "...", "cpaAlvo": "...", "observacao": "faixas estimadas, sem histórico próprio ainda"}
  },
  "avisos": ["..."]
}

REGRAS:
- O objetivo de campanha deve considerar que a venda acontece via WhatsApp com IA (Sales Brain) — "Mensagens WhatsApp" costuma ser o objetivo natural, mas avalie pelo produto.
- Toda estimativa numérica (orçamento, KPI) deve vir com a ressalva de que é ponto de partida, não promessa.
- Se a landing tiver problemas graves (score baixo), inclua no campo "avisos" que corrigir a página vem ANTES de escalar tráfego.
- Copies em português brasileiro, direto, sem clichê de guru.`,
    messages: [{
      role: 'user',
      content: JSON.stringify({
        produto: {
          nome: produto.nome,
          preco: produto.preco,
          conhecimento: produto.conhecimento_ia?.slice(0, 6000)
        },
        landing: landing ? {
          score: landing.landingScore,
          tempoCargaMs: landing.tempoCargaMs,
          problemas: landing.problemas,
          pontosFortes: landing.pontosFortes
        } : 'não analisada'
      })
    }]
  });

  const texto = resposta.content.find(c => c.type === 'text')?.text || '{}';
  try {
    return JSON.parse(texto.replace(/```json|```/g, '').trim());
  } catch (erro) {
    console.error('[traffic] Falha ao parsear plano:', erro.message);
    return null;
  }
}

/**
 * Formata o plano pra leitura no Telegram (texto puro).
 */
function formatarPlanoTelegram(produto, plano, landing) {
  if (!plano) return '❌ Não foi possível gerar o plano de tráfego.';

  const canais = (plano.canais || [])
    .sort((a, b) => b.score - a.score)
    .map(c => `${c.canal}: ${c.score}`)
    .join(' | ');

  const copyA = plano.copies?.[0];

  return `🎯 TRAFFIC BRAIN — ${produto.nome}

${landing ? `📄 Landing Score: ${landing.landingScore}/100 (carga ${(landing.tempoCargaMs / 1000).toFixed(1)}s)` : '📄 Landing não analisada'}

👥 PÚBLICO: ${plano.audiencia?.faixaEtaria}, ${plano.audiencia?.genero}
Interesses: ${(plano.audiencia?.interesses || []).slice(0, 5).join(', ')}

📣 CANAIS: ${canais}

🎯 Objetivo: ${plano.objetivoCampanha}
💰 Orçamento inicial: R$ ${plano.orcamento?.inicialDiario}/dia
Escala: ${plano.orcamento?.regraEscala}

🎬 Criativo: ${plano.criativos?.formatoRecomendado} (${plano.criativos?.quantidade}x)
Gancho principal: "${plano.criativos?.ganchos?.[0]}"

✍️ COPY A:
${copyA?.headline}
${copyA?.textoPrincipal}
CTA: ${copyA?.cta}

${(plano.avisos || []).length ? '⚠️ ' + plano.avisos.join('\n⚠️ ') : ''}

Plano completo (JSON com copies A/B, persona, keywords e config Meta Ads): GET /traffic/plano/CODIGO`;
}

module.exports = { gerarPlanoTrafego, formatarPlanoTelegram };
