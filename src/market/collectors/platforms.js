/**
 * Configuração de cada plataforma de afiliado pro coletor genérico.
 *
 * IMPORTANTE: URLs e seletores foram definidos a partir do padrão público
 * de cada plataforma — o primeiro teste real pode exigir ajuste fino
 * (mesma ressalva dos coletores Hotmart/Kiwify). Ajustes ficam aqui,
 * sem tocar na mecânica do genericCollector.
 *
 * Kairos: existem várias plataformas com esse nome (Kairos Way BR,
 * Kairós Afiliados PT, etc.) — por isso as URLs vêm do .env
 * (KAIROS_LOGIN_URL / KAIROS_MARKETPLACE_URL). Configure conforme a sua.
 */

const num = v => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null);

const PLATAFORMAS = [
  {
    nome: 'eduzz',
    envEmail: 'EDUZZ_EMAIL',
    envPassword: 'EDUZZ_PASSWORD',
    loginUrl: 'https://accounts.eduzz.com/login',
    marketplaceUrl: 'https://console.eduzz.com/affiliate/marketplace',
    seletorEmail: 'input[type="email"], input[name="email"]',
    seletorSenha: 'input[type="password"], input[name="password"]',
    seletorBotaoLogin: 'button[type="submit"]',
    padraoApiInterna: /marketplace|affiliate|product|content/i,
    mapear: item => ({
      plataforma: 'eduzz',
      external_id: String(item.id || item.content_id || item.contentId || ''),
      nome: item.title || item.name || item.content_title || null,
      categoria: item.category?.name || item.category || null,
      preco: num(item.price?.value ?? item.price ?? item.value),
      comissao_pct: num(item.commission_percentage ?? item.affiliate_commission ?? item.commission),
      comissao_valor: num(item.commission_value),
      temperatura: num(item.blueprint ?? item.score ?? item.ranking),
      url: item.sales_url || item.salesPageUrl || item.url || null
    })
  },
  {
    nome: 'braip',
    envEmail: 'BRAIP_EMAIL',
    envPassword: 'BRAIP_PASSWORD',
    loginUrl: 'https://ev.braip.com/login',
    marketplaceUrl: 'https://ev.braip.com/afiliado/mercado',
    seletorEmail: 'input[type="email"], input[name="email"]',
    seletorSenha: 'input[type="password"], input[name="password"]',
    seletorBotaoLogin: 'button[type="submit"]',
    padraoApiInterna: /mercado|market|affiliate|product/i,
    mapear: item => ({
      plataforma: 'braip',
      external_id: String(item.id || item.product_id || item.product_key || ''),
      nome: item.name || item.product_name || item.title || null,
      categoria: item.category?.name || item.category || null,
      preco: num(item.price ?? item.product_price),
      comissao_pct: num(item.commission_percentage ?? item.commission),
      comissao_valor: num(item.commission_value),
      temperatura: num(item.temperature ?? item.score),
      url: item.sales_page || item.url || null
    })
  },
  {
    nome: 'monetizze',
    envEmail: 'MONETIZZE_EMAIL',
    envPassword: 'MONETIZZE_PASSWORD',
    loginUrl: 'https://app.monetizze.com.br/login',
    marketplaceUrl: 'https://app.monetizze.com.br/mercado',
    seletorEmail: 'input[type="email"], input[name="email"], input[name="login"]',
    seletorSenha: 'input[type="password"], input[name="password"], input[name="senha"]',
    seletorBotaoLogin: 'button[type="submit"]',
    padraoApiInterna: /mercado|market|produto|product/i,
    mapear: item => ({
      plataforma: 'monetizze',
      external_id: String(item.id || item.codigo || item.product_id || ''),
      nome: item.nome || item.name || item.produto || null,
      categoria: item.categoria || item.category || null,
      preco: num(item.preco ?? item.valor ?? item.price),
      comissao_pct: num(item.comissao_percentual ?? item.comissao ?? item.commission),
      comissao_valor: num(item.comissao_valor),
      temperatura: num(item.temperatura ?? item.ranking),
      url: item.pagina_vendas || item.url || null
    })
  },
  {
    nome: 'cakto',
    envEmail: 'CAKTO_EMAIL',
    envPassword: 'CAKTO_PASSWORD',
    loginUrl: 'https://app.cakto.com.br/login',
    marketplaceUrl: 'https://app.cakto.com.br/affiliates/marketplace',
    seletorEmail: 'input[type="email"], input[name="email"]',
    seletorSenha: 'input[type="password"], input[name="password"]',
    seletorBotaoLogin: 'button[type="submit"]',
    padraoApiInterna: /marketplace|affiliate|product/i,
    mapear: item => ({
      plataforma: 'cakto',
      external_id: String(item.id || item.product_id || item.uuid || ''),
      nome: item.name || item.title || item.product_name || null,
      categoria: item.category?.name || item.category || null,
      preco: num(item.price ?? item.amount),
      comissao_pct: num(item.commission_percentage ?? item.affiliate_commission ?? item.commission),
      comissao_valor: num(item.commission_value),
      temperatura: num(item.score ?? item.ranking),
      url: item.sales_page_url || item.checkout_url || item.url || null
    })
  },
  {
    nome: 'kairos',
    envEmail: 'KAIROS_EMAIL',
    envPassword: 'KAIROS_PASSWORD',
    // URLs configuráveis: há mais de uma plataforma chamada "Kairos".
    // Defina no .env conforme a sua (ex: Kairos Way ou Kairós Afiliados).
    get loginUrl() { return process.env.KAIROS_LOGIN_URL || 'https://app.kairosway.com.br/login'; },
    get marketplaceUrl() { return process.env.KAIROS_MARKETPLACE_URL || 'https://app.kairosway.com.br/marketplace'; },
    seletorEmail: 'input[type="email"], input[name="email"]',
    seletorSenha: 'input[type="password"], input[name="password"]',
    seletorBotaoLogin: 'button[type="submit"]',
    padraoApiInterna: /marketplace|affiliate|product|afiliado/i,
    mapear: item => ({
      plataforma: 'kairos',
      external_id: String(item.id || item.product_id || item.uuid || ''),
      nome: item.name || item.nome || item.title || null,
      categoria: item.category?.name || item.categoria || item.category || null,
      preco: num(item.price ?? item.preco ?? item.amount),
      comissao_pct: num(item.commission_percentage ?? item.comissao ?? item.commission),
      comissao_valor: num(item.commission_value ?? item.comissao_valor),
      temperatura: num(item.score ?? item.ranking),
      url: item.sales_page_url || item.pagina_vendas || item.url || null
    })
  }
];

module.exports = { PLATAFORMAS };
