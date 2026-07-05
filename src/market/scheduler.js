const { coletarHotmart } = require('./collectors/hotmart');
const { coletarKiwify } = require('./collectors/kiwify');
const { coletarGenerico } = require('./collectors/genericCollector');
const { PLATAFORMAS } = require('./collectors/platforms');
const { enriquecerComTrends } = require('./collectors/trends');
const { criarProduto } = require('./models');
const { autoReject } = require('./quality');
const { gerarFingerprint, compararPlataformas } = require('./fingerprint');
const { enriquecerTopProdutos } = require('./enrichment');
const { persistirColeta, salvarDNA, detectarMovimento } = require('./persistence');
const { gerarRelatorio } = require('./analyst');
const { enviarTelegram } = require('./telegram');

/**
 * Pipeline diário do Market Brain:
 * Connectors → Normalizer → Auto Reject → Fingerprint → Trends → Score →
 * Enrichment (top N) → Comparator → persiste → movimento → relatório.
 */
async function rodarAnaliseDiaria() {
  console.log('[market] Iniciando análise diária...');
  const inicio = Date.now();

  // 1. CONNECTORS — coleta crua de cada plataforma
  const [hotmart, kiwify] = await Promise.all([
    coletarHotmart({ maxProdutos: 100 }),
    coletarKiwify({ maxProdutos: 100 })
  ]);

  const porPlataforma = { hotmart: hotmart.length, kiwify: kiwify.length };
  const brutos = [...hotmart, ...kiwify];

  for (const config of PLATAFORMAS) {
    const produtos = await coletarGenerico(config, { maxProdutos: 100 });
    porPlataforma[config.nome] = produtos.length;
    brutos.push(...produtos);
  }

  if (brutos.length === 0) {
    await enviarTelegram('⚠️ Market Brain: nenhum produto coletado hoje. Verifique credenciais das plataformas nos logs.');
    return;
  }

  // 2. NORMALIZER — converte tudo pro modelo canônico
  const normalizados = brutos.map(criarProduto).filter(Boolean);

  // 3. AUTO REJECT — corta produto ruim antes de gastar processamento
  const rejeitados = [];
  const aprovados = normalizados.filter(p => {
    const r = autoReject(p);
    if (!r.aprovado) rejeitados.push({ titulo: p.title, motivo: r.motivo });
    return r.aprovado;
  });
  console.log(`[market] Auto Reject: ${rejeitados.length} descartados, ${aprovados.length} seguem no funil`);

  // 4. FINGERPRINT — identifica o mesmo produto em plataformas diferentes
  for (const p of aprovados) p.fingerprint = gerarFingerprint(p.title);
  const duplicadosCrossPlataforma = compararPlataformas(aprovados);

  // 5. TRENDS — só os melhores por comissão (economia de consultas)
  const coletados = aprovados;

  // 2. Enriquece com Google Trends (só os top por comissão, pra economizar consultas)
  const ordenadosPorComissao = [...coletados].sort(
    (a, b) => (b.comissao_pct ?? 0) - (a.comissao_pct ?? 0)
  );
  const enriquecidos = await enriquecerComTrends(ordenadosPorComissao, { maxConsultas: 30 });

  // 6. SCORE + persistência (source score aplicado dentro da persistência)
  const persistidos = await persistirColeta(enriquecidos);

  // 7. ENRICHMENT (Market DNA) — só o top N por score, custo controlado
  const ordenados = [...persistidos].sort((a, b) => b.opportunityScore - a.opportunityScore);
  await enriquecerTopProdutos(ordenados);
  await salvarDNA(ordenados);
  const top10 = ordenados.slice(0, 10);

  // 8. Movimento vs. dia anterior
  const movimento = await detectarMovimento(persistidos);

  // 9. Relatório executivo via IA (inclui duplicados cross-plataforma)
  const relatorio = await gerarRelatorio({
    totalAnalisados: persistidos.length,
    rejeitadosHoje: rejeitados.length,
    porPlataforma,
    top10,
    movimento,
    duplicadosCrossPlataforma: duplicadosCrossPlataforma.slice(0, 5)
  });

  // 10. Envio
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
