/**
 * Página de Carreiras — definições puras (servidor e cliente).
 * URL pública: /carreiras/{slug da organização} e /carreiras/{org}/vagas/{slug da vaga}.
 * O slug da organização é o já existente em `organizacoes.slug`; o da vaga é
 * gerado na criação (título + 6 caracteres aleatórios) e não muda ao editar o título.
 */

export const MODALIDADE = { presencial: "Presencial", hibrido: "Híbrido", remoto: "Remoto" } as const;
export type Modalidade = keyof typeof MODALIDADE;

export const TIPO_CONTRATACAO = { clt: "CLT", pj: "PJ", estagio: "Estágio", temporario: "Temporário", aprendiz: "Aprendiz" } as const;
export type TipoContratacao = keyof typeof TIPO_CONTRATACAO;

/** Rótulo de modalidade tolerante a valores legados (texto livre do CRM). */
export const nomeModalidade = (v: string | null) => (v ? (MODALIDADE[v as Modalidade] ?? v) : null);
export const nomeContratacao = (v: string | null) => (v ? (TIPO_CONTRATACAO[v as TipoContratacao] ?? v) : null);

/** Chave de modalidade a partir de valor legado ("Híbrido" → "hibrido"); desconhecido → "". */
export function chaveModalidade(v: string | null) {
  if (!v) return "";
  if (v in MODALIDADE) return v;
  const n = slugificar(v);
  return (Object.keys(MODALIDADE) as Modalidade[]).find((k) => n.startsWith(k.slice(0, 5))) ?? "";
}

export function slugificar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Situação da vaga na Página de Carreiras. Só "publicada" recebe candidaturas. */
export function situacaoPublica(v: { publicada: boolean; status: string }) {
  if (v.status === "fechada" || v.status === "cancelada") return { chave: "encerrada", nome: "Encerrada", tom: "neutro" } as const;
  if (!v.publicada) return { chave: "rascunho", nome: "Não publicada", tom: "neutro" } as const;
  if (v.status === "pausada") return { chave: "pausada", nome: "Pausada (não recebe candidaturas)", tom: "alerta" } as const;
  return { chave: "publicada", nome: "Publicada", tom: "sucesso" } as const;
}

export const recebeCandidaturas = (v: { publicada: boolean; status: string }) => v.publicada && v.status === "aberta";

export const NOTIFICACAO = {
  pendente: { nome: "Aviso pendente", tom: "alerta" },
  enviado: { nome: "Aviso enviado", tom: "sucesso" },
  falhou: { nome: "Falha no aviso", tom: "perigo" },
} as const;

export const caminhoCarreiras = (orgSlug: string) => `/carreiras/${orgSlug}`;
export const caminhoVagaPublica = (orgSlug: string, vagaSlug: string) => `/carreiras/${orgSlug}/vagas/${vagaSlug}`;

/** Tipos aceitos na candidatura pública: PDF e DOCX (conferidos também pela assinatura do arquivo). */
export const TIPOS_CANDIDATURA: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
export const TAMANHO_CURRICULO = 10 * 1024 * 1024;
