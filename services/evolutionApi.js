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
  // Formato padrão do webhook da Evolution API (evento messages.upsert)
  const data = body.data;
  const telefone = data.key.remoteJid.split('@')[0];
  const mensagem = data.message?.conversation
    || data.message?.extendedTextMessage?.text
    || '';

  return { telefone, mensagem };
}

module.exports = { enviarMensagemWhatsapp, extrairDadosEvolution };
