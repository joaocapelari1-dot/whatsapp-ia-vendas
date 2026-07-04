const axios = require('axios');
const { supabase } = require('../../lib/supabase');
const { importarProduto } = require('../../services/importarProduto');

/**
 * Telegram do Market Brain — mesmo padrão do LeilaoWDO:
 * envia o relatório diário e processa o comando /importar CODIGO.
 *
 * Variáveis no .env:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID;

async function enviarTelegram(texto) {
  if (!TOKEN() || !CHAT_ID()) {
    console.warn('[market] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes — relatório só no log:');
    console.log(texto);
    return;
  }

  await axios.post(`https://api.telegram.org/bot${TOKEN()}/sendMessage`, {
    chat_id: CHAT_ID(),
    text: texto
  });
}

/**
 * Processa update de webhook do Telegram. Suporta:
 *   /importar CODIGO  → busca o produto no radar e importa pro Sales Brain
 */
async function processarComandoTelegram(update) {
  const texto = update?.message?.text || '';
  const match = texto.match(/^\/importar\s+(\S+)/i);
  if (!match) return;

  const codigo = match[1]; // formato: HOTMART_123456 ou KIWIFY_abc
  const [plataforma, ...resto] = codigo.split('_');
  const externalId = resto.join('_');

  const { data: produto } = await supabase
    .from('market_products')
    .select('*')
    .eq('plataforma', plataforma.toLowerCase())
    .eq('external_id', externalId)
    .single();

  if (!produto) {
    await enviarTelegram(`❌ Produto ${codigo} não encontrado no radar.`);
    return;
  }

  if (!produto.url) {
    await enviarTelegram(`❌ Produto "${produto.nome}" está sem URL de página de vendas no radar — importa manualmente pelo endpoint com o link correto.`);
    return;
  }

  await enviarTelegram(`⏳ Importando "${produto.nome}" pro Sales Brain...`);

  try {
    // Código curto pro link de clique-para-chat (ex: MKT_HOTMART_123)
    const codigoSales = `MKT${externalId}`.slice(0, 20);
    await importarProduto(produto.url, codigoSales);

    await supabase
      .from('market_products')
      .update({ importado: true })
      .eq('id', produto.id);

    const numeroWpp = process.env.EVOLUTION_INSTANCE_PHONE || 'SEUNUMERO';
    const linkWhatsapp = `https://wa.me/${numeroWpp}?text=${encodeURIComponent(`Quero saber sobre #${codigoSales}`)}`;

    await enviarTelegram(`✅ "${produto.nome}" importado!\n\nLink de vendas pra divulgar:\n${linkWhatsapp}`);
  } catch (erro) {
    await enviarTelegram(`❌ Falha ao importar "${produto.nome}": ${erro.message}`);
  }
}

module.exports = { enviarTelegram, processarComandoTelegram };
