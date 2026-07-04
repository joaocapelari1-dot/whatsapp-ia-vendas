const { coletarHotmart } = require('./collectors/hotmart');
const { coletarKiwify } = require('./collectors/kiwify');
const { enriquecerComTrends } = require('./collectors/trends');
const { persistirColeta, detectarMovimento } = require('./persistence');
const { gerarRelatorio } = require('./analyst');
const { enviarTelegram } = require('./telegram');

/**
 * Pipeline diário do Market Brain v1:
 * coleta → trends → score → persiste → movimento → relatório → Telegram.
 */
async function rodarAnaliseDiaria() {
  console.log('[market] Iniciando análise diária...');
  const inicio = Date.now();

  // 1. Coleta das plataformas (em paralelo)
  const [hotmart, kiwify] = await Promise.all([
    coletarHotmart({ maxProdutos: 100 }),
    coletarKiwify({ maxProdutos: 100 })
  ]);

  const coletados = [...hotmart, ...kiwify];
  if (coletados.length === 0) {
    await enviarTelegram('⚠️ Market Brain: nenhum produto coletado hoje. Verifique credenciais Hotmart/Kiwify nos logs.');
    return;
  }

  // 2. Enriquece com Google Trends (só os top por comissão, pra economizar consultas)
  const ordenadosPorComissao = [...coletados].sort(
    (a, b) => (b.comissao_pct ?? 0) - (a.comissao_pct ?? 0)
  );
  const enriquecidos = await enriquecerComTrends(ordenadosPorComissao, { maxConsultas: 30 });

  // 3. Score + persistência
  const persistidos = await persistirColeta(enriquecidos);

  // 4. Movimento vs. dia anterior
  const top10 = [...persistidos]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 10);

  const movimento = await detectarMovimento(persistidos);

  // 5. Relatório executivo via IA
  const relatorio = await gerarRelatorio({
    totalAnalisados: persistidos.length,
    porPlataforma: { hotmart: hotmart.length, kiwify: kiwify.length },
    top10,
    movimento
  });

  // 6. Envio
  await enviarTelegram(relatorio);

  const duracao = ((Date.now() - inicio) / 1000).toFixed(0);
  console.log(`[market] Análise concluída em ${duracao}s — ${persistidos.length} produtos processados.`);
}

/**
 * Agenda a execução diária. Horário configurável via MARKET_CRON_HOUR
 * (hora local do servidor, padrão 6h). Implementação com setInterval
 * simples — verifica a cada minuto se é hora de rodar.
 */
let ultimaExecucao = null;

function iniciarScheduler() {
  const horaAlvo = parseInt(process.env.MARKET_CRON_HOUR || '6', 10);

  setInterval(async () => {
    const agora = new Date();
    const hoje = agora.toISOString().slice(0, 10);

    if (agora.getHours() === horaAlvo && ultimaExecucao !== hoje) {
      ultimaExecucao = hoje;
      try {
        await rodarAnaliseDiaria();
      } catch (erro) {
        console.error('[market] Erro na análise diária:', erro);
        await enviarTelegram(`❌ Market Brain falhou: ${erro.message}`).catch(() => {});
      }
    }
  }, 60 * 1000);

  console.log(`[market] Scheduler ativo — análise diária às ${horaAlvo}h.`);
}

module.exports = { rodarAnaliseDiaria, iniciarScheduler };
