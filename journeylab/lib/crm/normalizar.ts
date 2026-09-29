/** Normalização para detecção de duplicidade (seguro para qualquer camada). */

export function normalizarTexto(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarEmail(s?: string | null) {
  const v = s?.trim().toLowerCase();
  return v ? v : null;
}

/** Últimos 11 dígitos (DDD + número), ignorando +55, espaços e pontuação. */
export function normalizarTelefone(s?: string | null) {
  const d = (s ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.slice(-11);
}

/** Identificador do perfil: linkedin.com/in/<id>. */
export function normalizarLinkedin(s?: string | null) {
  const v = (s ?? "").trim().toLowerCase();
  if (!v) return null;
  const m = v.match(/linkedin\.com\/in\/([^/?#\s]+)/);
  return (m ? m[1] : v.replace(/^@/, "")).replace(/\/+$/, "") || null;
}

export const STATUS_CANDIDATURA = {
  inscrito: { nome: "Inscrito", tom: "neutro" },
  em_avaliacao: { nome: "Em avaliação", tom: "info" },
  entrevista: { nome: "Entrevista", tom: "info" },
  aprovado: { nome: "Aprovado", tom: "sucesso" },
  reprovado: { nome: "Não seguiu", tom: "neutro" },
  contratado: { nome: "Contratado", tom: "sucesso" },
  desistiu: { nome: "Desistiu", tom: "neutro" },
} as const;

export const STATUS_VAGA = {
  aberta: { nome: "Aberta", tom: "sucesso" },
  pausada: { nome: "Pausada", tom: "alerta" },
  fechada: { nome: "Fechada", tom: "neutro" },
  cancelada: { nome: "Cancelada", tom: "neutro" },
} as const;

export const TIPO_INTERACAO = {
  nota: "Nota",
  ligacao: "Ligação",
  email: "E-mail",
  entrevista: "Entrevista",
  sistema: "Registro do sistema",
} as const;
