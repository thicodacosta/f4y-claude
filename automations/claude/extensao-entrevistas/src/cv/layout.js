/**
 * Layout do currículo gerado: estrutura (ordem e títulos das seções) e visual
 * (posição do logo, nome, estilo dos títulos, formato das experiências e da
 * formação). Vem do modelo de currículo da empresa (src/cv/model.js) ou, sem
 * modelo, do padrão. Sem dependências pesadas: usado pelo painel e pela
 * geração dos documentos.
 */
export const SECTION_KEYS = [
  "resumo",
  "experiencias",
  "formacao",
  "idiomas",
  "competencias",
  "certificacoes",
  "informacoesAdicionais",
];

/** Opções de cada campo visual; o primeiro valor é o padrão. */
export const LAYOUT_OPTIONS = {
  logoPosicao: ["esquerda", "centro", "direita"],
  nomeAlinhamento: ["esquerda", "centro"],
  subtituloAlinhamento: ["esquerda", "centro"],
  // faixa: pequeno, espaçado, com linha abaixo · destaque: maior, negrito, sem
  // linha · sublinhado: negrito no tamanho do texto, com linha abaixo.
  estiloTitulos: ["faixa", "destaque", "sublinhado"],
  corTitulos: ["destaque", "escuro"],
  // blocos: cargo (ou empresa) e período numa linha, o outro abaixo ·
  // linha_unica: "Empresa — Cargo | Período" numa linha só.
  experienciaFormato: ["blocos", "linha_unica"],
  experienciaCabecalho: ["cargo_primeiro", "empresa_primeiro"],
  atividadesFormato: ["topicos", "paragrafo"],
  // blocos: curso e ano numa linha, instituição abaixo · lista: um tópico por
  // curso, "Instituição — Curso | Ano".
  formacaoFormato: ["blocos", "lista"],
  competenciasFormato: ["linha", "topicos"],
};

/** Layout padrão (sem modelo). */
export const DEFAULT_LAYOUT = {
  secoes: [
    { chave: "resumo", titulo: "Resumo profissional" },
    { chave: "experiencias", titulo: "Experiência profissional" },
    { chave: "formacao", titulo: "Formação acadêmica" },
    { chave: "idiomas", titulo: "Idiomas" },
    { chave: "competencias", titulo: "Competências" },
    { chave: "certificacoes", titulo: "Certificações e cursos" },
    { chave: "informacoesAdicionais", titulo: "Informações adicionais" },
  ],
  linhaCabecalho: true,
  nomeMaiusculo: false,
  titulosMaiusculos: true,
  ...Object.fromEntries(Object.entries(LAYOUT_OPTIONS).map(([key, values]) => [key, values[0]])),
  orientacoes: "",
};

/**
 * Garante um layout utilizável: chaves válidas e sem repetição, valores
 * conhecidos. Seções que o modelo não tem entram no fim, com o título padrão,
 * para não perder conteúdo do currículo original.
 */
export function normalizeLayout(layout) {
  if (!layout) return DEFAULT_LAYOUT;
  const seen = new Set();
  const secoes = [];
  for (const s of layout.secoes ?? []) {
    if (!SECTION_KEYS.includes(s.chave) || seen.has(s.chave) || !s.titulo?.trim()) continue;
    seen.add(s.chave);
    secoes.push({ chave: s.chave, titulo: s.titulo.trim() });
  }
  for (const s of DEFAULT_LAYOUT.secoes) if (!seen.has(s.chave)) secoes.push(s);

  const result = { ...DEFAULT_LAYOUT, secoes, orientacoes: layout.orientacoes?.trim() ?? "" };
  for (const [key, values] of Object.entries(LAYOUT_OPTIONS)) {
    if (values.includes(layout[key])) result[key] = layout[key];
  }
  for (const key of ["linhaCabecalho", "nomeMaiusculo", "titulosMaiusculos"]) {
    if (typeof layout[key] === "boolean") result[key] = layout[key];
  }
  return result;
}
