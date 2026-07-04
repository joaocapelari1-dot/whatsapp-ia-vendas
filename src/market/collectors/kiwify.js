const puppeteer = require('puppeteer');

/**
 * Coletor Kiwify v1.
 * Mesma estratégia do coletor Hotmart: navega logado na área de afiliados
 * (mercado de afiliação) e intercepta as respostas JSON internas.
 *
 * Variáveis necessárias no .env:
 *   KIWIFY_EMAIL, KIWIFY_PASSWORD
 */

const MARKETPLACE_URL = 'https://dashboard.kiwify.com.br/affiliate/marketplace';

async function coletarKiwify({ maxProdutos = 100 } = {}) {
  const email = process.env.KIWIFY_EMAIL;
  const senha = process.env.KIWIFY_PASSWORD;

  if (!email || !senha) {
    console.warn('[market] KIWIFY_EMAIL/KIWIFY_PASSWORD ausentes — pulando coletor Kiwify');
    return [];
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const produtosCapturados = [];

  try {
    const page = await browser.newPage();

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) return;
      if (!/marketplace|affiliate|product/i.test(url)) return;

      try {
        const json = await response.json();
        const lista = extrairListaProdutos(json);
        if (lista.length) produtosCapturados.push(...lista);
      } catch (_) { /* ignora */ }
    });

    // Login
    await page.goto('https://dashboard.kiwify.com.br/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.type('input[type="email"], input[name="email"]', email, { delay: 30 });
    await page.type('input[type="password"], input[name="password"]', senha, { delay: 30 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    await page.goto(MARKETPLACE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    for (let i = 0; i < 5 && produtosCapturados.length < maxProdutos; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2500));
    }
  } catch (erro) {
    console.error('[market] Erro no coletor Kiwify:', erro.message);
  } finally {
    await browser.close();
  }

  const vistos = new Set();
  const unicos = produtosCapturados.filter(p => {
    if (!p.external_id || vistos.has(p.external_id)) return false;
    vistos.add(p.external_id);
    return true;
  });

  console.log(`[market] Kiwify: ${unicos.length} produtos coletados`);
  return unicos.slice(0, maxProdutos);
}

function extrairListaProdutos(json) {
  const candidatos = json?.items || json?.products || json?.data || [];
  if (!Array.isArray(candidatos)) return [];

  return candidatos
    .filter(item => item && (item.name || item.product_name || item.title))
    .map(item => ({
      plataforma: 'kiwify',
      external_id: String(item.id || item.product_id || ''),
      nome: item.name || item.product_name || item.title,
      categoria: item.category || null,
      preco: item.price ?? item.product_price ?? null,
      comissao_pct: item.commission_percentage ?? item.commission ?? null,
      comissao_valor: item.commission_value ?? null,
      temperatura: item.featured ? 80 : null, // Kiwify não tem "temperatura"; destaque vira proxy
      url: item.sales_page_url || item.url || null
    }));
}

module.exports = { coletarKiwify };
