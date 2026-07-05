/**
 * PRODUCT FINGERPRINT — identifica o mesmo produto em plataformas diferentes.
 * v1: título normalizado (sem acento/pontuação/stopwords, ordenado) vira a
 * impressão digital. Cobre o caso comum: mesmo curso publicado com título
 * igual ou quase igual em Hotmart + Kiwify + Braip.
 */

const STOPWORDS = new Set([
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na',
  'para', 'pra', 'com', 'por', 'que', 'um', 'uma', 'seu', 'sua', 'como',
  'curso', 'metodo', 'método', 'completo', 'definitivo', 'oficial', '2024', '2025', '2026'
]);

function gerarFingerprint(titulo) {
  if (!titulo) return null;

  const palavras = titulo
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')                      // remove pontuação
    .split(/\s+/)
    .filter(p => p.length > 2 && !STOPWORDS.has(p))
    .sort();                                            // ordem não importa

  if (palavras.length === 0) return null;
  return palavras.join('-');
}

/**
 * COMMISSION COMPARATOR — agrupa produtos pelo fingerprint e, quando o mesmo
 * produto existe em 2+ plataformas, indica a melhor oportunidade.
 * v1 compara o que coletamos de verdade: comissão (% e valor) e preço.
 * Cookie/recorrência/aprovação entram quando os coletores extraírem esses campos.
 */
function compararPlataformas(produtos) {
  const grupos = new Map();

  for (const p of produtos) {
    if (!p.fingerprint) continue;
    if (!grupos.has(p.fingerprint)) grupos.set(p.fingerprint, []);
    grupos.get(p.fingerprint).push(p);
  }

  const duplicados = [];

  for (const [fingerprint, grupo] of grupos) {
    const plataformasUnicas = new Set(grupo.map(p => p.platform));
    if (plataformasUnicas.size < 2) continue;

    // Melhor oferta: maior comissão em valor absoluto; empate → maior %
    const ordenado = [...grupo].sort((a, b) => {
      const valorA = a.commissionValue ?? (a.price && a.commissionPct ? a.price * a.commissionPct / 100 : 0);
      const valorB = b.commissionValue ?? (b.price && b.commissionPct ? b.price * b.commissionPct / 100 : 0);
      if (valorB !== valorA) return valorB - valorA;
      return (b.commissionPct ?? 0) - (a.commissionPct ?? 0);
    });

    duplicados.push({
      fingerprint,
      titulo: ordenado[0].title,
      melhorPlataforma: ordenado[0].platform,
      comparacao: ordenado.map(p => ({
        plataforma: p.platform,
        comissaoPct: p.commissionPct,
        comissaoValor: p.commissionValue,
        preco: p.price
      }))
    });
  }

  return duplicados;
}

module.exports = { gerarFingerprint, compararPlataformas };
