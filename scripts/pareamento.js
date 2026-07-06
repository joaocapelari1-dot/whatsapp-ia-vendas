/**
 * SCRIPT DE PAREAMENTO — roda no SEU PC (Windows), não no Railway.
 *
 * O que ele faz: abre um Chrome DE VERDADE, visível, na tela de login da
 * plataforma escolhida. Você loga manualmente — com e-mail, senha, 2FA,
 * o que a plataforma pedir, exatamente como sempre fez. Quando o login
 * terminar (a página do marketplace/dashboard carregar), aperta Enter no
 * terminal. O script salva a sessão (cookies) direto no Supabase.
 *
 * A partir daí, o coletor no Railway usa essa sessão salva — sem precisar
 * logar de novo, sem 2FA, sem e-mail — até ela expirar (então basta rodar
 * este script de novo pra "re-parear").
 *
 * COMO RODAR (no terminal, dentro da pasta do projeto):
 *   node scripts/pareamento.js braip
 *   node scripts/pareamento.js cakto
 *   node scripts/pareamento.js kiwify
 *   (troque pelo nome da plataforma que quer parear)
 *
 * Pré-requisito: ter um arquivo .env na raiz do projeto com
 * SUPABASE_URL e SUPABASE_SERVICE_KEY preenchidos (mesmos do Railway).
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const URLS_LOGIN = {
  hotmart: 'https://app.hotmart.com/login',
  kiwify: 'https://dashboard.kiwify.com.br/login',
  eduzz: 'https://accounts.eduzz.com/login',
  braip: 'https://ev.braip.com/login',
  monetizze: 'https://app.monetizze.com.br/login',
  cakto: 'https://app.cakto.com.br/login',
  kairos: process.env.KAIROS_LOGIN_URL || 'https://app.kairosway.com.br/login'
};

async function perguntar(pergunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(pergunta, resposta => { rl.close(); resolve(resposta); }));
}

async function main() {
  const plataforma = process.argv[2];

  if (!plataforma || !URLS_LOGIN[plataforma]) {
    console.log('Uso: node scripts/pareamento.js <plataforma>');
    console.log('Plataformas disponíveis:', Object.keys(URLS_LOGIN).join(', '));
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY no .env local.');
    process.exit(1);
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  console.log(`\nAbrindo o navegador na tela de login da ${plataforma}...`);
  console.log('Faça o login normalmente (e-mail, senha, código de verificação, o que pedir).');
  console.log('Quando terminar e a página do painel/marketplace carregar, volte aqui e aperte Enter.\n');

  const browser = await puppeteer.launch({
    headless: false, // navegador VISÍVEL — é você quem loga
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto(URLS_LOGIN[plataforma], { waitUntil: 'networkidle2' });

  await perguntar('Pressione Enter aqui depois de concluir o login na janela do navegador... ');

  const cookies = await page.cookies();

  if (!cookies || cookies.length === 0) {
    console.error('Nenhum cookie capturado — o login não parece ter sido concluído. Tente novamente.');
    await browser.close();
    process.exit(1);
  }

  const { error } = await supabase
    .from('platform_sessions')
    .upsert({
      plataforma,
      cookies,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'plataforma' });

  await browser.close();

  if (error) {
    console.error('Erro ao salvar sessão no Supabase:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Sessão da ${plataforma} salva com sucesso! O coletor no Railway já pode usá-la.`);
  console.log('Quando essa sessão expirar (semanas/meses), rode este script de novo pra reparear.\n');
}

main();
