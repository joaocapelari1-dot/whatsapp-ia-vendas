const axios = require('axios');

/**
 * Cliente da API OFICIAL da Hotmart (developers.hotmart.com).
 * Autenticação por client_credentials — sem OTP, sem e-mail, sem navegador.
 *
 * Credenciais (criar em app.hotmart.com → Ferramentas → Credenciais):
 *   HOTMART_CLIENT_ID
 *   HOTMART_CLIENT_SECRET
 *   HOTMART_BASIC        (token "Basic" gerado junto com as credenciais)
 *
 * Usos:
 *  1. vendasRecentes() — confirma comissões de afiliado automaticamente
 *     (fecha o ciclo: checkout enviado → venda confirmada na plataforma)
 *  2. produtosProprios() — catálogo dos SEUS produtos (produtor)
 *
 * Nota: o marketplace público de afiliação (temperatura, catálogo de
 * terceiros) não é exposto pela API oficial — pra isso continua o coletor
 * de navegador com sessão persistente.
 */

const AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const API_BASE = 'https://developers.hotmart.com/payments/api/v1';

let tokenCache = { token: null, expiraEm: 0 };

async function obterToken() {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basic = process.env.HOTMART_BASIC;

  if (!clientId || !clientSecret || !basic) {
    throw new Error('Credenciais da API Hotmart ausentes (HOTMART_CLIENT_ID / HOTMART_CLIENT_SECRET / HOTMART_BASIC)');
  }

  // Reusa token válido (expira em ~48h; renovamos com 5 min de folga)
  if (tokenCache.token && Date.now() < tokenCache.expiraEm - 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const resposta = await axios.post(
    `${AUTH_URL}?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    null,
    { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' } }
  );

  tokenCache = {
    token: resposta.data.access_token,
    expiraEm: Date.now() + (resposta.data.expires_in ?? 172800) * 1000
  };

  return tokenCache.token;
}

/**
 * Vendas recentes (inclui vendas como afiliado). Usada pra confirmar
 * comissões automaticamente e marcar leads como "comprou".
 * @param {object} opts — { desdeMs: timestamp inicial (padrão: últimas 24h) }
 */
async function vendasRecentes({ desdeMs } = {}) {
  const token = await obterToken();
  const inicio = desdeMs ?? Date.now() - 24 * 60 * 60 * 1000;

  const resposta = await axios.get(`${API_BASE}/sales/history`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      start_date: inicio,
      end_date: Date.now(),
      max_results: 100
    }
  });

  return (resposta.data?.items || []).map(v => ({
    transacao: v.purchase?.transaction,
    status: v.purchase?.status,                 // APPROVED | COMPLETE | CANCELED...
    produto: v.product?.name,
    produtoId: v.product?.id != null ? String(v.product.id) : null,
    valor: v.purchase?.price?.value ?? null,
    comissaoAfiliado: (v.commissions || [])
      .filter(c => c.source === 'AFFILIATE')
      .reduce((soma, c) => soma + (c.value ?? 0), 0) || null,
    compradorEmail: v.buyer?.email || null,
    data: v.purchase?.approved_date || v.purchase?.order_date || null
  }));
}

/**
 * Testa a conexão com a API (útil no setup).
 */
async function testarConexao() {
  try {
    await obterToken();
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro.response?.data?.error_description || erro.message };
  }
}

module.exports = { obterToken, vendasRecentes, testarConexao };
