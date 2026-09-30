/**
 * Pulse — transforma a distribuição agregada (jl_distribuicao_pulse) em
 * resultados por tipo de pergunta. Puro: usado pela tela, exportação e IA.
 */
import { calcularEnps, COM_LINHAS, faixa, LIKERT, media, NUMERICOS, TEXTOS, type LinhaDistribuicao, type PerguntaDef } from "./perguntas";

export type Item = { rotulo: string; n: number; pct: number };
export type ResultadoPergunta = {
  pergunta: PerguntaDef;
  respondentes: number;
  forma: "opcoes" | "numerico" | "matriz_opcoes" | "matriz_numerica" | "textos";
  itens: Item[];
  media: number | null;
  enps: ReturnType<typeof calcularEnps>;
  linhas: { rotulo: string; media: number | null; itens: Item[]; textos: string[] }[];
  textos: string[];
};

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export function analisarPergunta(p: PerguntaDef, dbId: string, dist: LinhaDistribuicao[], comentarios: { pergunta_id: string; linha: number | null; texto: string }[]): ResultadoPergunta {
  const minhas = dist.filter((d) => d.pergunta_id === dbId);
  const respondentes = Math.max(0, ...minhas.map((d) => d.respondentes), comentarios.filter((c) => c.pergunta_id === dbId).length ? 1 : 0);
  const textosDe = (linha: number | null) => comentarios.filter((c) => c.pergunta_id === dbId && (linha === null || c.linha === linha)).map((c) => c.texto);
  const base: ResultadoPergunta = { pergunta: p, respondentes, forma: "opcoes", itens: [], media: null, enps: null, linhas: [], textos: [] };

  if (TEXTOS.includes(p.type) && p.type !== "matrix_text") return { ...base, forma: "textos", textos: textosDe(null), respondentes: textosDe(null).length };

  if (p.type === "matrix_text") {
    return { ...base, forma: "matriz_opcoes", linhas: (p.matrixRows ?? []).map((rotulo, i) => ({ rotulo, media: null, itens: [], textos: textosDe(i) })) };
  }

  if (p.type === "matrix_multiple_choice") {
    const colunas = p.matrixColumns ?? [];
    return {
      ...base,
      forma: "matriz_opcoes",
      linhas: (p.matrixRows ?? []).map((rotulo, i) => {
        const daLinha = minhas.filter((d) => d.linha === i);
        const total = daLinha.reduce((s, d) => s + d.n, 0);
        return { rotulo, media: null, textos: [], itens: colunas.map((c, j) => ({ rotulo: c, n: daLinha.find((d) => d.opcao === String(j))?.n ?? 0, pct: pct(daLinha.find((d) => d.opcao === String(j))?.n ?? 0, total) })) };
      }),
    };
  }

  if (COM_LINHAS.includes(p.type)) {
    const f = faixa(p);
    return {
      ...base,
      forma: "matriz_numerica",
      linhas: (p.matrixRows ?? []).map((rotulo, i) => {
        const daLinha = minhas.filter((d) => d.linha === i);
        const total = daLinha.reduce((s, d) => s + d.n, 0);
        const itens: Item[] = [];
        for (let v = f.min; v <= f.max; v++) itens.push({ rotulo: String(v), n: daLinha.find((d) => d.valor === v)?.n ?? 0, pct: pct(daLinha.find((d) => d.valor === v)?.n ?? 0, total) });
        return { rotulo, media: media(daLinha), itens, textos: [] };
      }),
    };
  }

  if (NUMERICOS.includes(p.type)) {
    const f = faixa(p);
    const total = minhas.reduce((s, d) => s + d.n, 0);
    const itens: Item[] = [];
    // Slider com faixa longa: agrupa só os valores presentes.
    const valores = p.type === "slider" && f.max - f.min > 20 ? [...new Set(minhas.map((d) => d.valor!))].sort((a, b) => a - b) : Array.from({ length: f.max - f.min + 1 }, (_, i) => f.min + i);
    for (const v of valores) {
      const n = minhas.find((d) => d.valor === v)?.n ?? 0;
      itens.push({ rotulo: p.type === "likert" ? `${v} · ${LIKERT[v - 1]}` : String(v), n, pct: pct(n, total) });
    }
    const enps = p.type === "nps" ? calcularEnps(new Map(minhas.map((d) => [d.valor!, d.n]))) : null;
    return { ...base, forma: "numerico", itens, media: media(minhas), enps };
  }

  // Opções (uma, várias, lista, imagem, sim/não)
  if (p.type === "boolean") {
    const sim = minhas.find((d) => d.valor === 1)?.n ?? 0;
    const nao = minhas.find((d) => d.valor === 0)?.n ?? 0;
    return { ...base, itens: [{ rotulo: "Sim", n: sim, pct: pct(sim, sim + nao) }, { rotulo: "Não", n: nao, pct: pct(nao, sim + nao) }] };
  }
  return {
    ...base,
    itens: (p.options ?? []).map((o) => {
      const n = minhas.find((d) => d.opcao === o.id)?.n ?? 0;
      return { rotulo: o.label, n, pct: pct(n, respondentes) };
    }),
  };
}

/** Média numérica geral da pergunta (inclui matrizes numéricas) — para comparar departamentos. */
export function mediaGeral(r: ResultadoPergunta) {
  if (r.forma === "numerico") return r.media;
  if (r.forma === "matriz_numerica") {
    const ms = r.linhas.map((l) => l.media).filter((m): m is number => m !== null);
    return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null;
  }
  return null;
}

/** Resumo agregado em texto estruturado (sem comentários livres) — base para a IA. */
export function resumoParaIa(resultados: ResultadoPergunta[]) {
  return resultados
    .filter((r) => r.forma !== "textos" && r.pergunta.type !== "matrix_text")
    .map((r) => ({
      pergunta: r.pergunta.text,
      tipo: r.pergunta.type,
      respondentes: r.respondentes,
      media: r.media !== null ? Number(r.media.toFixed(2)) : undefined,
      enps: r.enps ? { valor: r.enps.enps, promotores: r.enps.promotores, neutros: r.enps.neutros, detratores: r.enps.detratores } : undefined,
      distribuicao: r.itens.length ? r.itens.map((i) => ({ opcao: i.rotulo, percentual: i.pct })) : undefined,
      linhas: r.linhas.length ? r.linhas.map((l) => ({ item: l.rotulo, media: l.media !== null ? Number(l.media.toFixed(2)) : undefined, distribuicao: l.itens.map((i) => ({ opcao: i.rotulo, percentual: i.pct })) })) : undefined,
    }));
}
