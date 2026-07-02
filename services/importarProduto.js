const puppeteer = require('puppeteer');
const { supabase } = require('../lib/supabase');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

async function importarProduto(url, codigo) {
  // 1. Cria registro inicial
  const { data: produto, error: erroInsert } = await supabase
    .from('produtos')
    .insert({ codigo, url_origem: url, status: 'processando' })
    .select()
    .single();

  if (erroInsert) throw erroInsert;

  try {
    // 2. Scraping renderizado (cobre landing pages pesadas em JS)
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const conteudo = await page.evaluate(() => document.body.innerText);
    await browser.close();

    // 3. Claude lê e estrutura o conhecimento do produto
    const resposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analise esta página de vendas e extraia em formato estruturado:
1. Nome do produto
2. Preço (se houver)
3. Principais benefícios/promessas
4. Público-alvo
5. Objeções comuns que o produto resolve
6. Tom de voz da página (pra IA imitar no atendimento)

Conteúdo da página:
${conteudo.slice(0, 15000)}`
      }]
    });

    const conhecimento = resposta.content.find(c => c.type === 'text')?.text || '';

    // Tenta extrair preço automaticamente do texto (heurística simples)
    const matchPreco = conteudo.match(/R\$\s?([\d.,]+)/);
    const precoDetectado = matchPreco
      ? parseFloat(matchPreco[1].replace('.', '').replace(',', '.'))
      : null;

    // 4. Salva
    const { data: produtoAtualizado } = await supabase
      .from('produtos')
      .update({
        descricao_raw: conteudo.slice(0, 10000),
        conhecimento_ia: conhecimento,
        preco: precoDetectado,
        status: 'pronto'
      })
      .eq('id', produto.id)
      .select()
      .single();

    return produtoAtualizado;
  } catch (erro) {
    await supabase.from('produtos').update({ status: 'erro' }).eq('id', produto.id);
    throw erro;
  }
}

module.exports = { importarProduto };
