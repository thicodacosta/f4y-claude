/**
 * Layout do currículo gerado: ordem e títulos das seções e formatos. Vem do
 * modelo de currículo da empresa (src/cv/model.js) ou, sem modelo, do padrão.
 * Sem dependências pesadas: usado pelo painel e pela geração dos documentos.
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

/** Layout padrão (sem modelo): o mesmo usado até aqui. */
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
  titulosMaiusculos: true,
  experienciaCabecalho: "cargo_primeiro",
  atividadesFormato: "topicos",
  competenciasFormato: "linha",
  orientacoes: "",
};

/**
 * Garante um layout utilizável: chaves válidas e sem repetição. Seções que o
 * modelo não tem entram no fim, com o título padrão, para não perder conteúdo
 * do currículo original.
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
  return { ...DEFAULT_LAYOUT, ...layout, secoes, orientacoes: layout.orientacoes?.trim() ?? "" };
}

