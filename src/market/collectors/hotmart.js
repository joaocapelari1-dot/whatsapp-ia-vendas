const puppeteer = require('puppeteer');

/**
 * Coletor Hotmart v1.
 * Estratégia: navega no marketplace de afiliação LOGADO (com sua conta de
 * afiliado) e intercepta as respostas JSON que a própria página consome —
 * muito mais estável que scraping de HTML renderizado.
 *
 * Variáveis necessárias no .env:
 *   HOTMART_EMAIL, HOTMART_PASSWORD
 *
 * Nota de manutenção: se a Hotmart redesenhar o marketplace, os seletores
 * de login e o padrão de URL das APIs internas podem mudar — ajuste esperado.
 */

const MARKETPLACE_URL = 'https://app.hotmart.com/market';

async function coletarHotmart({ maxProdutos = 100 } = {}) {
  const email = process.env.HOTMART_EMAIL;
  const senha = process.env.HOTMART_PASSWORD;

  if (!email || !senha) {
    console.warn('[market] HOTMART_EMAIL/HOTMART_PASSWORD ausentes — pulando coletor Hotmart');
    return [];
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const produtosCapturados = [];

  try {
    const page = await browser.newPage();

    // Intercepta respostas JSON do marketplace enquanto navega
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) return;
      // Padrões de endpoints internos do marketplace (produtos/ofertas)
      if (!/market|product|offer|catalog/i.test(url)) return;

      try {
        const json = await response.json();
        const lista = extrairListaProdutos(json);
        if (lista.length) produtosCapturados.push(...lista);
      } catch (_) { /* respostas não-JSON ou vazias são ignoradas */ }
    });

    // Login
    await page.goto('https://app.hotmart.com/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.type('input[type="email"], input[name="email"]', email, { delay: 30 });
    await page.type('input[type="password"], input[name="password"]', senha, { delay: 30 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    // Navega pelo marketplace pra disparar as requisições internas
    await page.goto(MARKETPLACE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Rola a página pra carregar mais produtos (lazy load)
    for (let i = 0; i < 5 && produtosCapturados.length < maxProdutos; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2500));
    }
  } catch (erro) {
    console.error('[market] Erro no coletor Hotmart:', erro.message);
  } finally {
    await browser.close();
  }

  // Dedup por external_id
  const vistos = new Set();
  const unicos = produtosCapturados.filter(p => {
    if (!p.external_id || vistos.has(p.external_id)) return false;
    vistos.add(p.external_id);
    return true;
  });

  console.log(`[market] Hotmart: ${unicos.length} produtos coletados`);
  return unicos.slice(0, maxProdutos);
}

/**
 * Extrai produtos de estruturas JSON variadas dos endpoints internos.
 * Defensivo por design: a estrutura pode variar entre endpoints/versões.
 */
function extrairListaProdutos(json) {
  const candidatos = json?.items || json?.products || json?.content || json?.data?.items || [];
  if (!Array.isArray(candidatos)) return [];

  return candidatos
    .filter(item => item && (item.name || item.productName || item.title))
    .map(item => ({
      plataforma: 'hotmart',
      external_id: String(item.id || item.productId || item.ucode || ''),
      nome: item.name || item.productName || item.title,
      categoria: item.category?.name || item.categoryName || null,
      preco: item.price?.value ?? item.price ?? null,
      comissao_pct: item.commission?.percentage ?? item.commissionPercentage ?? null,
      comissao_valor: item.commission?.value ?? null,
      temperatura: item.temperature ?? item.blueprint ?? null,
      url: item.url || item.salesPageUrl || (item.ucode ? `https://app.hotmart.com/market/product/${item.ucode}` : null)
    }));
}

module.exports = { coletarHotmart };
