const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

async function enviarMensagemWhatsapp(telefone, mensagem) {
  const numeroLimpo = telefone.replace(/\D/g, '');

  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        number: numeroLimpo,
        text: mensagem
      },
      {
        headers: {
          apikey: EVOLUTION_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (erro) {
    console.error('Erro ao enviar mensagem WhatsApp:', erro.response?.data || erro.message);
    throw erro;
  }
}

function extrairDadosEvolution(body) {
  // A Evolution API manda vários tipos de evento pro mesmo webhook
  // (mensagem, presença "digitando", confirmação de leitura, conexão...).
  // Só nos interessa messages.upsert com uma mensagem de texto real.
  if (body?.event && body.event !== 'messages.upsert') {
    return { telefone: null, mensagem: null };
  }

  const data = body?.data;
  const key = data?.key;

  if (!key?.remoteJid) {
    return { telefone: null, mensagem: null };
  }

  // Ignora mensagens enviadas por nós mesmos (eco do próprio envio) e
  // mensagens de grupo (remoteJid termina em @g.us)
  if (key.fromMe || key.remoteJid.endsWith('@g.us')) {
    return { telefone: null, mensagem: null };
  }

  const telefone = key.remoteJid.split('@')[0];
  const mensagem = data.message?.conversation
    || data.message?.extendedTextMessage?.text
    || '';

  return { telefone, mensagem };
}

module.exports = { enviarMensagemWhatsapp, extrairDadosEvolution };
