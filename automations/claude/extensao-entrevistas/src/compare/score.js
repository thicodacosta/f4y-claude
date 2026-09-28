// A nota não é "chutada" pelo modelo: ele avalia cada requisito e a
// compatibilidade é calculada aqui, de forma transparente e igual para todos.
// Usada pelo Comparativo e pela Shortlist.
const LEVEL_POINTS = { atende: 1, parcial: 0.5, nao_evidenciado: 0 };
const TYPE_WEIGHT = { obrigatorio: 2, desejavel: 1 };

/** Compatibilidade de 0 a 100 a partir das avaliações por requisito. */
export function scoreCandidate(candidate, requisitos) {
  let earned = 0;
  let total = 0;
  for (const req of requisitos) {
    const weight = TYPE_WEIGHT[req.tipo] ?? 1;
    const evaluation = candidate.avaliacoes.find((a) => a.requisitoId === req.id);
    total += weight;
    earned += weight * (LEVEL_POINTS[evaluation?.nivel] ?? 0);
  }
  return total ? Math.round((earned / total) * 100) : 0;
}
