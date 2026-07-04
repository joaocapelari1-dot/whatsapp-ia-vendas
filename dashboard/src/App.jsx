import React, { useEffect, useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const NOMES_ESTAGIOS = {
  discovery: 'Descoberta',
  interest: 'Interesse',
  comparison: 'Comparação',
  objection: 'Objeção',
  negotiation: 'Negociação',
  ready_to_buy: 'Pronto',
  checkout: 'Checkout',
  after_sales: 'Pós-venda'
};

function classeScore(score) {
  if (score >= 75) return 'alto';
  if (score >= 50) return 'medio';
  return 'baixo';
}

export default function App() {
  const [resumo, setResumo]       = useState(null);
  const [radar, setRadar]         = useState([]);
  const [trafego, setTrafego]     = useState([]);
  const [vendas, setVendas]       = useState(null);
  const [erro, setErro]           = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  // Radar
  const [radarRodando, setRadarRodando] = useState(false);
  const [radarMsg, setRadarMsg]         = useState(null);

  // Tráfego
  const [gerandoPlano, setGerandoPlano] = useState(false);
  const [planoMsg, setPlanoMsg]         = useState(null);
  const [codigoSelecionado, setCodigoSelecionado] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [r, ra, t, v] = await Promise.all([
        fetch(`${API}/dashboard/resumo`).then(x => x.json()),
        fetch(`${API}/dashboard/radar`).then(x => x.json()),
        fetch(`${API}/dashboard/trafego`).then(x => x.json()),
        fetch(`${API}/dashboard/vendas`).then(x => x.json())
      ]);
      setResumo(r);
      setRadar(Array.isArray(ra) ? ra : []);
      setTrafego(Array.isArray(t) ? t : []);
      setVendas(v);
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro('Não foi possível carregar os dados. Verifique se a API está no ar.');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const rodarRadar = async () => {
    setRadarRodando(true);
    setRadarMsg(null);
    try {
      const res = await fetch(`${API}/market/rodar`, { method: 'POST' });
      const d = await res.json();
      setRadarMsg('Radar iniciado! Os resultados aparecem aqui em alguns minutos.');
      setTimeout(() => carregar(), 10000);
    } catch {
      setRadarMsg('Erro ao iniciar o radar. Tente novamente.');
    } finally {
      setRadarRodando(false);
    }
  };

  const gerarPlano = async () => {
    if (!codigoSelecionado) return;
    setGerandoPlano(true);
    setPlanoMsg(null);
    try {
      const res = await fetch(`${API}/traffic/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoSelecionado })
      });
      const d = await res.json();
      if (d.erro) {
        setPlanoMsg(`Erro: ${d.erro}`);
      } else {
        setPlanoMsg(`Plano gerado para "${codigoSelecionado}"! Aparece abaixo em instantes.`);
        setTimeout(() => carregar(), 5000);
      }
    } catch {
      setPlanoMsg('Erro ao gerar plano. Tente novamente.');
    } finally {
      setGerandoPlano(false);
    }
  };

  if (erro) return <div className="wrap"><div className="erro">{erro}</div></div>;
  if (!resumo) return <div className="wrap"><div className="vazio">Carregando…</div></div>;

  const escalados    = resumo.atencao?.leadsEscalados || [];
  const diasVendas   = vendas ? Object.entries(vendas.porDia).slice(-14) : [];
  const maxVendasDia = Math.max(1, ...diasVendas.map(([, n]) => n));

  // Produtos disponíveis para gerar plano (do radar, sem plano ainda)
  const produtosSemPlano = radar.filter(p => !trafego.find(t => t.codigo === p.codigoImportacao));
  const todosProdutos    = radar;

  return (
    <div className="wrap">
      <header>
        <h1>Central de Vendas</h1>
        <div className="header-acoes">
          {atualizadoEm && (
            <span className="atualizado">
              Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn-secundario" onClick={carregar}>↻ Atualizar</button>
        </div>
      </header>

      {/* Fluxo dos três cérebros */}
      <div className="fluxo">
        <div className="etapa">
          <div className="rotulo">Radar de produtos</div>
          <div className="valor">{resumo.radar.produtosAnalisadosHoje}</div>
          <div className="sub">analisados hoje</div>
        </div>
        <div className="seta">→</div>
        <div className="etapa">
          <div className="rotulo">Conversas de venda</div>
          <div className="valor">{resumo.funil.totalConversas}</div>
          <div className="sub">{resumo.funil.mensagensHoje} mensagens hoje · score médio {resumo.funil.buyScoreMedio}</div>
        </div>
        <div className="seta">→</div>
        <div className="etapa">
          <div className="rotulo">Checkouts enviados</div>
          <div className="valor">{resumo.vendas.checkoutsHoje}</div>
          <div className="sub">hoje · {resumo.vendas.checkoutsTotal} no total</div>
        </div>
      </div>

      {escalados.length > 0 && (
        <div className="atencao">
          <strong>{escalados.length} {escalados.length === 1 ? 'lead esperando' : 'leads esperando'} atendimento humano</strong>
          {' — '}{escalados.map(l => l.telefone).join(', ')}. Responda pelo WhatsApp e libere a conversa.
        </div>
      )}

      <section>
        <h2>Funil de vendas</h2>
        <div className="funil">
          {Object.entries(NOMES_ESTAGIOS).map(([chave, nome]) => (
            <div className="estagio" key={chave}>
              <div className="n">{resumo.funil.porEstagio[chave] || 0}</div>
              <div className="l">{nome}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── RADAR ── */}
      <section>
        <div className="secao-header">
          <h2>Radar de produtos — hoje</h2>
          <button
            className="btn-principal"
            onClick={rodarRadar}
            disabled={radarRodando}
          >
            {radarRodando ? 'Buscando…' : '🔍 Rodar Radar'}
          </button>
        </div>
        {radarMsg && <div className="feedback">{radarMsg}</div>}
        {radar.length === 0 ? (
          <div className="vazio">Nenhum produto analisado ainda. Clique em "Rodar Radar" para buscar agora.</div>
        ) : (
          <div className="cards">
            {radar.map((p, i) => (
              <div className="card" key={i}>
                <div className="titulo">{p.nome}</div>
                <div className="meta">
                  {p.plataforma}{p.categoria ? ` · ${p.categoria}` : ''}
                  {p.preco ? ` · R$ ${Number(p.preco).toFixed(0)}` : ''}
                  {p.comissaoPct ? ` · comissão ${p.comissaoPct}%` : ''}
                </div>
                <div className="scoreLinha">
                  <span className={`scoreNum ${classeScore(p.score)}`}>{p.score}</span>
                  <span className="confidence">confiança {p.confidence}%{p.trend != null ? ` · tendência ${p.trend}` : ''}</span>
                </div>
                <div className="links">
                  {p.linkPagina && <a href={p.linkPagina} target="_blank" rel="noreferrer">Ver página</a>}
                  {p.importado
                    ? <span className="tag">Importado</span>
                    : <span title={`No Telegram: /importar ${p.codigoImportacao}`}>Importar: {p.codigoImportacao}</span>}
                  {p.linkWhatsapp && <a className="principal" href={p.linkWhatsapp} target="_blank" rel="noreferrer">Link de venda</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── TRÁFEGO ── */}
      <section>
        <div className="secao-header">
          <h2>Planos de tráfego</h2>
          <div className="acao-inline">
            <select
              value={codigoSelecionado}
              onChange={e => setCodigoSelecionado(e.target.value)}
              disabled={gerandoPlano}
            >
              <option value="">Escolher produto…</option>
              {todosProdutos.map((p, i) => (
                <option key={i} value={p.codigoImportacao}>
                  {p.nome || p.codigoImportacao}
                </option>
              ))}
            </select>
            <button
              className="btn-principal"
              onClick={gerarPlano}
              disabled={gerandoPlano || !codigoSelecionado}
            >
              {gerandoPlano ? 'Gerando…' : '📋 Gerar Plano'}
            </button>
          </div>
        </div>
        {planoMsg && <div className="feedback">{planoMsg}</div>}
        {trafego.length === 0 ? (
          <div className="vazio">Nenhum plano gerado ainda. Rode o radar primeiro, depois escolha um produto acima.</div>
        ) : (
          <div className="cards">
            {trafego.map((t, i) => (
              <div className="card" key={i}>
                <div className="titulo">{t.produto}</div>
                <div className="meta">
                  {t.canalPrincipal || 'canal a definir'}
                  {t.orcamentoDiario ? ` · R$ ${t.orcamentoDiario}/dia` : ''}
                </div>
                <div className="scoreLinha">
                  <span className={`scoreNum ${classeScore(t.landingScore ?? 0)}`}>{t.landingScore ?? '—'}</span>
                  <span className="confidence">landing score</span>
                </div>
                <div className="links">
                  <a href={`${API}/traffic/plano/${t.codigo}`} target="_blank" rel="noreferrer">Plano completo</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Checkouts — últimos 14 dias</h2>
        {diasVendas.length === 0 ? (
          <div className="vazio">Nenhum checkout enviado ainda. Quando a IA mandar o primeiro link de compra, aparece aqui.</div>
        ) : (
          <div className="barras">
            {diasVendas.map(([dia, n]) => (
              <div className="dia" key={dia} title={`${dia}: ${n}`}>
                <div className="barra" style={{ height: `${(n / maxVendasDia) * 100}%` }} />
                <div className="rot">{dia.slice(8)}/{dia.slice(5, 7)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
