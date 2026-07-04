const puppeteer = require('puppeteer');

/**
 * Coletor genérico para marketplaces de afiliado LOGADOS.
 * Cada plataforma é uma config (URLs, credenciais, mapeamento de campos) —
 * a mecânica é sempre a mesma: login → navegar no marketplace →
 * interceptar JSONs internos → normalizar produtos.
 *
 * Nota de manutenção: seletores de login e padrões de URL de API interna
 * podem mudar quando a plataforma redesenha — ajuste esperado por plataforma,
 * feito na config, sem tocar nesta mecânica.
 */
async function coletarGenerico(config, { maxProdutos = 100 } = {}) {
  const email = process.env[config.envEmail];
  const senha = process.env[config.envPassword];

  if (!email || !senha) {
    console.warn(`[market] ${config.envEmail}/${config.envPassword} ausentes — pulando coletor ${config.nome}`);
    return [];
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const capturados = [];

  try {
    const page = await browser.newPage();

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) return;
      if (!config.padraoApiInterna.test(url)) return;

      try {
        const json = await response.json();
        const lista = extrairLista(json, config);
        if (lista.length) capturados.push(...lista);
      } catch (_) { /* ignora respostas não parseáveis */ }
    });

    // Login
    await page.goto(config.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.type(config.seletorEmail, email, { delay: 30 });
    await page.type(config.seletorSenha, senha, { delay: 30 });
    await Promise.all([
      page.click(config.seletorBotaoLogin),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
    ]);

    // Marketplace + scroll pra lazy load
    await page.goto(config.marketplaceUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    for (let i = 0; i < 5 && capturados.length < maxProdutos; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2500));
    }
  } catch (erro) {
    console.error(`[market] Erro no coletor ${config.nome}:`, erro.message);
  } finally {
    await browser.close();
  }

  // Dedup por external_id
  const vistos = new Set();
  const unicos = capturados.filter(p => {
    if (!p.external_id || vistos.has(p.external_id)) return false;
    vistos.add(p.external_id);
    return true;
  });

  console.log(`[market] ${config.nome}: ${unicos.length} produtos coletados`);
  return unicos.slice(0, maxProdutos);
}

/**
 * Extrai lista de produtos de estruturas JSON variadas usando o mapeamento
 * da config. Defensivo: estruturas diferem entre endpoints/versões.
 */
function extrairLista(json, config) {
  const caminhos = [json?.items, json?.products, json?.content, json?.data?.items, json?.data, json?.results];
  const lista = caminhos.find(c => Array.isArray(c) && c.length) || [];

  return lista
    .map(item => config.mapear(item))
    .filter(p => p && p.nome && p.external_id);
}

module.exports = { coletarGenerico };
