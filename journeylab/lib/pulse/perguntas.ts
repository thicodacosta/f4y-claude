/**
 * Pulse — os 16 tipos de pergunta (puro: servidor, editor e página de resposta).
 * Cada resposta é normalizada em LINHAS atômicas (valor | opção | texto, com
 * linha de matriz quando houver) antes de ir ao banco; os resultados voltam
 * agregados por jl_distribuicao_pulse / jl_comentarios_pulse.
 */
import { z } from "zod";

export const TIPOS = [
  "multiple_choice_single",
  "multiple_choice_multiple",
  "dropdown",
  "image_choice",
  "boolean",
  "nps",
  "star_rating",
  "scale",
  "slider",
  "likert",
  "matrix_multiple_choice",
  "matrix_star",
  "matrix_scale",
  "matrix_text",
  "short_text",
  "long_text",
] as const;
export type TipoPergunta = (typeof TIPOS)[number];

export const NOME_TIPO: Record<TipoPergunta, string> = {
  multiple_choice_single: "Múltipla escolha (uma)",
  multiple_choice_multiple: "Múltipla escolha (várias)",
  dropdown: "Lista suspensa",
  image_choice: "Escolha por imagem",
  boolean: "Sim ou não",
  nps: "NPS (0 a 10)",
  star_rating: "Estrelas",
  scale: "Escala numérica",
  slider: "Controle deslizante",
  likert: "Concordância (Likert)",
  matrix_multiple_choice: "Matriz de múltipla escolha",
  matrix_star: "Matriz de estrelas",
  matrix_scale: "Matriz de escala",
  matrix_text: "Matriz de texto",
  short_text: "Texto curto",
  long_text: "Texto longo",
};

export type Opcao = { id: string; label: string; imageUrl?: string };
export type ConfigPergunta = {
  options?: Opcao[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  matrixRows?: string[];
  matrixColumns?: string[];
};
export type PerguntaDef = { id: string; type: TipoPergunta; text: string; required: boolean; order: number } & ConfigPergunta;

export const LIKERT = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"] as const;
export const COM_OPCOES: TipoPergunta[] = ["multiple_choice_single", "multiple_choice_multiple", "dropdown", "image_choice"];
export const COM_LINHAS: TipoPergunta[] = ["matrix_multiple_choice", "matrix_star", "matrix_scale", "matrix_text"];
export const NUMERICOS: TipoPergunta[] = ["nps", "star_rating", "scale", "slider", "likert", "matrix_star", "matrix_scale"];
export const TEXTOS: TipoPergunta[] = ["short_text", "long_text", "matrix_text"];

/** Faixa numérica efetiva de cada tipo. */
export function faixa(p: Pick<PerguntaDef, "type" | "scaleMin" | "scaleMax">) {
  switch (p.type) {
    case "nps":
      return { min: 0, max: 10 };
    case "likert":
      return { min: 1, max: 5 };
    case "star_rating":
    case "matrix_star":
      return { min: 1, max: p.scaleMax ?? 5 };
    case "slider":
      return { min: p.scaleMin ?? 0, max: p.scaleMax ?? 10 };
    default:
      return { min: p.scaleMin ?? 1, max: p.scaleMax ?? 5 };
  }
}

/** Configuração padrão ao escolher um tipo no editor. */
export function configPadrao(tipo: TipoPergunta): ConfigPergunta {
  const opc = (labels: string[]) => labels.map((label, i) => ({ id: `o${i + 1}`, label }));
  if (tipo === "image_choice") return { options: [{ id: "o1", label: "Opção 1", imageUrl: "" }, { id: "o2", label: "Opção 2", imageUrl: "" }] };
  if (COM_OPCOES.includes(tipo)) return { options: opc(["Opção 1", "Opção 2", "Opção 3"]) };
  if (tipo === "nps") return { scaleMin: 0, scaleMax: 10, scaleMinLabel: "Nada provável", scaleMaxLabel: "Muito provável" };
  if (tipo === "scale") return { scaleMin: 1, scaleMax: 10, scaleMinLabel: "Muito baixo", scaleMaxLabel: "Muito alto" };
  if (tipo === "slider") return { scaleMin: 0, scaleMax: 10, scaleMinLabel: "", scaleMaxLabel: "" };
  if (tipo === "star_rating" || tipo === "matrix_star") return { scaleMax: 5, ...(tipo === "matrix_star" ? { matrixRows: ["Item 1", "Item 2"] } : {}) };
  if (tipo === "matrix_multiple_choice") return { matrixRows: ["Item 1", "Item 2"], matrixColumns: ["Ruim", "Regular", "Bom", "Ótimo"] };
  if (tipo === "matrix_scale") return { matrixRows: ["Item 1", "Item 2"], scaleMin: 1, scaleMax: 5 };
  if (tipo === "matrix_text") return { matrixRows: ["Item 1", "Item 2"] };
  return {};
}

const texto = (max: number) => z.string().trim().max(max);

/** Validação da definição de uma pergunta (usada ao salvar a pesquisa ou um template). */
export const perguntaSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    type: z.enum(TIPOS),
    text: texto(300).min(3, "Toda pergunta precisa de um enunciado."),
    required: z.boolean(),
    order: z.number().int(),
    options: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/), label: texto(120).min(1, "Opção sem texto."), imageUrl: z.string().trim().max(500).optional() })).max(20).optional(),
    scaleMin: z.number().int().min(0).max(100).optional(),
    scaleMax: z.number().int().min(1).max(100).optional(),
    scaleMinLabel: texto(40).optional(),
    scaleMaxLabel: texto(40).optional(),
    matrixRows: z.array(texto(120).min(1, "Linha da matriz sem texto.")).max(15).optional(),
    matrixColumns: z.array(texto(60).min(1, "Coluna da matriz sem texto.")).max(10).optional(),
  })
  .superRefine((p, ctx) => {
    const erro = (m: string) => ctx.addIssue({ code: "custom", message: `“${p.text.slice(0, 40)}”: ${m}` });
    if (COM_OPCOES.includes(p.type)) {
      if (!p.options || p.options.length < 2) erro("inclua ao menos 2 opções.");
      if (p.options && new Set(p.options.map((o) => o.id)).size !== p.options.length) erro("opções repetidas.");
      if (p.type === "image_choice" && p.options?.some((o) => !o.imageUrl || !/^https:\/\//.test(o.imageUrl))) erro("cada opção precisa de uma imagem com endereço https://.");
    }
    if (COM_LINHAS.includes(p.type) && (!p.matrixRows || p.matrixRows.length < 1)) erro("inclua ao menos 1 linha na matriz.");
    if (p.type === "matrix_multiple_choice" && (!p.matrixColumns || p.matrixColumns.length < 2)) erro("inclua ao menos 2 colunas na matriz.");
    if (["scale", "slider", "matrix_scale"].includes(p.type)) {
      const f = faixa(p);
      if (f.max <= f.min) erro("o máximo da escala deve ser maior que o mínimo.");
      if (f.max - f.min > 100) erro("escala muito longa.");
    }
    if ((p.type === "star_rating" || p.type === "matrix_star") && (p.scaleMax ?? 5) > 10) erro("no máximo 10 estrelas.");
  });

export const perguntasSchema = z.array(perguntaSchema).min(1, "Inclua ao menos uma pergunta.").max(40, "No máximo 40 perguntas.");

export type Linha = { pergunta_id: string; linha?: number; valor?: number; opcao?: string; texto?: string };
export type ValorResposta = string | number | string[] | Record<string, string | number>;

/**
 * Converte a resposta de UMA pergunta em linhas atômicas, validando pelo tipo.
 * Retorna `erro` quando o valor é inválido ou falta resposta obrigatória.
 */
export function normalizarResposta(p: PerguntaDef & { dbId: string }, v: ValorResposta | undefined): { linhas: Linha[] } | { erro: string } {
  const vazio = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
  if (vazio) return p.required ? { erro: `Responda: “${p.text}”.` } : { linhas: [] };
  const invalido = { erro: `Resposta inválida em “${p.text}”.` };
  const idsOpcoes = new Set((p.options ?? []).map((o) => o.id));
  const base = { pergunta_id: p.dbId };
  const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  const naFaixa = (x: number, f = faixa(p)) => Number.isInteger(x) && x >= f.min && x <= f.max;

  switch (p.type) {
    case "multiple_choice_single":
    case "dropdown":
    case "image_choice":
      return typeof v === "string" && idsOpcoes.has(v) ? { linhas: [{ ...base, opcao: v }] } : invalido;
    case "multiple_choice_multiple": {
      if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && idsOpcoes.has(x))) return invalido;
      return { linhas: [...new Set(v as string[])].map((o) => ({ ...base, opcao: o })) };
    }
    case "boolean":
      return v === "sim" || v === "nao" ? { linhas: [{ ...base, valor: v === "sim" ? 1 : 0 }] } : invalido;
    case "nps":
    case "star_rating":
    case "scale":
    case "slider":
    case "likert": {
      const x = num(v);
      return naFaixa(x) ? { linhas: [{ ...base, valor: x }] } : invalido;
    }
    case "short_text":
    case "long_text": {
      if (typeof v !== "string") return invalido;
      const t = v.trim().slice(0, p.type === "short_text" ? 200 : 2000);
      if (!t) return p.required ? { erro: `Responda: “${p.text}”.` } : { linhas: [] };
      return { linhas: [{ ...base, texto: t }] };
    }
    default: {
      // Matrizes: { "<índice da linha>": valor }
      if (typeof v !== "object" || Array.isArray(v)) return invalido;
      const linhas: Linha[] = [];
      const rows = p.matrixRows ?? [];
      for (const [chave, bruto] of Object.entries(v)) {
        const i = Number(chave);
        if (!Number.isInteger(i) || i < 0 || i >= rows.length) return invalido;
        if (p.type === "matrix_multiple_choice") {
          const c = num(bruto);
          if (!Number.isInteger(c) || c < 0 || c >= (p.matrixColumns ?? []).length) return invalido;
          linhas.push({ ...base, linha: i, opcao: String(c) });
        } else if (p.type === "matrix_text") {
          const t = String(bruto ?? "").trim().slice(0, 500);
          if (t) linhas.push({ ...base, linha: i, texto: t });
        } else {
          const x = num(bruto);
          if (!naFaixa(x)) return invalido;
          linhas.push({ ...base, linha: i, valor: x });
        }
      }
      if (p.required && p.type !== "matrix_text" && linhas.length < rows.length) return { erro: `Responda todas as linhas de “${p.text}”.` };
      if (p.required && !linhas.length) return { erro: `Responda: “${p.text}”.` };
      return { linhas };
    }
  }
}

// ─── Resultados ───────────────────────────────────────────────────────────

export type LinhaDistribuicao = { pergunta_id: string; linha: number | null; opcao: string | null; valor: number | null; n: number; respondentes: number };

export function calcularEnps(contagens: Map<number, number>) {
  let total = 0,
    prom = 0,
    detr = 0;
  for (const [v, n] of contagens) {
    total += n;
    if (v >= 9) prom += n;
    else if (v <= 6) detr += n;
  }
  if (!total) return null;
  const enps = Math.round(((prom - detr) / total) * 100);
  return { enps, promotores: prom, neutros: total - prom - detr, detratores: detr, total, classe: classificarEnps(enps) };
}

/** Classificação do eNPS: Excelente ≥ 50 · Bom ≥ 0 · Crítico < 0. */
export function classificarEnps(enps: number) {
  if (enps >= 50) return { nome: "Excelente", tom: "sucesso" as const };
  if (enps >= 0) return { nome: "Bom", tom: "alerta" as const };
  return { nome: "Crítico", tom: "perigo" as const };
}

/** Média de uma lista de linhas numéricas. */
export function media(linhas: LinhaDistribuicao[]) {
  let s = 0,
    n = 0;
  for (const l of linhas) if (l.valor !== null) {
    s += l.valor * l.n;
    n += l.n;
  }
  return n ? s / n : null;
}

export const umaCasa = (x: number) => x.toFixed(1).replace(".", ",");

/** Pergunta gravada no banco → definição usada pelo editor e pela página de resposta. */
export function deBanco(q: { id: string; tipo: string; texto: string; obrigatoria: boolean; ordem: number; config: unknown }): PerguntaDef {
  const c = (q.config ?? {}) as Record<string, unknown>;
  return { ...(c as object), id: (c.chave as string) ?? q.id, type: q.tipo as TipoPergunta, text: q.texto, required: q.obrigatoria, order: q.ordem } as PerguntaDef;
}
