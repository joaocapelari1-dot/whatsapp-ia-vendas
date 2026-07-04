const puppeteer = require('puppeteer');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

/**
 * Landing Analyzer v1: visita a página de vendas e gera um Landing Score
 * 0-100 com recomendações. Combina métricas objetivas (tempo de carga,
 * mobile, elementos presentes) com avaliação qualitativa via Claude.
 */
async function analisarLanding(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Simula mobile (maior parte do tráfego de anúncio é mobile)
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    const inicio = Date.now();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    const tempoCargaMs = Date.now() - inicio;

    // Métricas objetivas extraídas do DOM
    const metricas = await page.evaluate(() => {
      const texto = document.body.innerText || '';
      return {
        temVideo: !!document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]'),
        qtdBotoesCta: document.querySelectorAll('a[href*="pay"], a[href*="checkout"], button').length,
        temDepoimentos: /depoimento|avalia[cç][aã]o|cliente|aprovad|recomend/i.test(texto),
        temGarantia: /garantia|reembolso|devolu[cç][aã]o|risco zero/i.test(texto),
        temUrgencia: /vagas|limitad|hoje|agora|[uú]ltim|promo[cç][aã]o/i.test(texto),
        tamanhoTexto: texto.length,
        conteudo: texto.slice(0, 8000)
      };
    });

    await browser.close();

    // Score objetivo (0-50): carga + elementos de conversão
    let scoreObjetivo = 0;
    if (tempoCargaMs < 3000) scoreObjetivo += 15;
    else if (tempoCargaMs < 6000) scoreObjetivo += 8;
    if (metricas.temVideo) scoreObjetivo += 8;
    if (metricas.qtdBotoesCta >= 2) scoreObjetivo += 7;
    if (metricas.temDepoimentos) scoreObjetivo += 8;
    if (metricas.temGarantia) scoreObjetivo += 7;
    if (metricas.temUrgencia) scoreObjetivo += 5;

    // Score qualitativo via Claude (0-50): clareza da oferta, credibilidade
    const avaliacao = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `Você avalia páginas de vendas para tráfego pago. Responda APENAS JSON válido:
{"scoreQualitativo": 0-50, "pontosFortes": ["..."], "problemas": ["..."], "recomendacoes": ["..."]}
Critérios: clareza da oferta (headline diz o que é e pra quem?), credibilidade (provas reais?), fluidez do caminho até o CTA, adequação a tráfego frio.`,
      messages: [{ role: 'user', content: `Tempo de carga: ${tempoCargaMs}ms\nConteúdo da página:\n${metricas.conteudo}` }]
    });

    let qualitativo = { scoreQualitativo: 25, pontosFortes: [], problemas: [], recomendacoes: [] };
    try {
      const texto = avaliacao.content.find(c => c.type === 'text')?.text || '{}';
      qualitativo = JSON.parse(texto.replace(/```json|```/g, '').trim());
    } catch (_) { /* mantém default */ }

    return {
      landingScore: Math.min(100, scoreObjetivo + (qualitativo.scoreQualitativo ?? 25)),
      tempoCargaMs,
      metricas: {
        temVideo: metricas.temVideo,
        qtdBotoesCta: metricas.qtdBotoesCta,
        temDepoimentos: metricas.temDepoimentos,
        temGarantia: metricas.temGarantia,
        temUrgencia: metricas.temUrgencia
      },
      pontosFortes: qualitativo.pontosFortes || [],
      problemas: qualitativo.problemas || [],
      recomendacoes: qualitativo.recomendacoes || []
    };
  } catch (erro) {
    await browser.close().catch(() => {});
    console.error('[traffic] Erro no Landing Analyzer:', erro.message);
    return null;
  }
}

module.exports = { analisarLanding };
