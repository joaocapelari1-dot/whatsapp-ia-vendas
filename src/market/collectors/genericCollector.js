const puppeteer = require('puppeteer');
const { supabase } = require('../../../lib/supabase');

/**
 * Coletor genérico para marketplaces de afiliado LOGADOS.
 *
 * DOIS CAMINHOS DE AUTENTICAÇÃO:
 * 1. SESSÃO SALVA (preferencial) — se existir uma sessão pareada
 *    manualmente (scripts/pareamento.js), reaproveita os cookies e pula o
 *    login inteiro. Resolve 2FA/confirmação por e-mail, que travam login
 *    automatizado.
 * 2. LOGIN POR FORMULÁRIO (fallback) — se não houver sessão salva, tenta
 *    o preenchimento automático de e-mail/senha. Só funciona em
 *    plataformas sem 2FA/OTP ativo.
 *
 * Nota de manutenção: seletores de login e padrões de URL de API interna
 * podem mudar quando a plataforma redesenha — ajuste esperado por plataforma,
 * feito na config, sem tocar nesta mecânica.
 */
async function coletarGenerico(config, { maxProdutos = 100 } = {}) {
  const sessaoSalva = await buscarSessaoSalva(config.nome);
  const email = process.env[config.envEmail];
  const senha = process.env[config.envPassword];

  if (!sessaoSalva && (!email || !senha)) {
    console.warn(`[market] ${config.envEmail}/${config.envPassword} ausentes e sem sessão pareada — pulando coletor ${config.nome}`);
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

    if (sessaoSalva) {
      // CAMINHO 1: reaproveita cookies — pula login inteiro
      await page.setCookie(...sessaoSalva);
      console.log(`[market] ${config.nome}: usando sessão pareada (sem login)`);
    } else {
      // CAMINHO 2: fallback — login automático por formulário
      await page.goto(config.loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.type(config.seletorEmail, email, { delay: 30 });
      await page.type(config.seletorSenha, senha, { delay: 30 });
      await Promise.all([
        page.click(config.seletorBotaoLogin),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
      ]);
    }

    // Marketplace + scroll pra lazy load
    await page.goto(config.marketplaceUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Se a sessão salva expirou, a plataforma costuma redirecionar pro
    // login — detecta isso e avisa (em vez de coletar 0 produtos calado)
    if (sessaoSalva && /login|signin|entrar/i.test(page.url())) {
      console.warn(`[market] ${config.nome}: sessão pareada parece ter expirado (redirecionou pro login). Rode scripts/pareamento.js ${config.nome} de novo.`);
    }

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
 * Busca sessão pareada manualmente (scripts/pareamento.js) no Supabase.
 * Retorna null se não existir — o coletor cai pro fallback de formulário.
 */
async function buscarSessaoSalva(plataforma) {
  try {
    const { data } = await supabase
      .from('platform_sessions')
      .select('cookies')
      .eq('plataforma', plataforma)
      .single();

    return data?.cookies || null;
  } catch (_) {
    return null; // tabela vazia ou sem registro — comportamento normal
  }
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
