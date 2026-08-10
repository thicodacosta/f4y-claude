export type StatusProximaAcao = { cor: string; label: string; chave: "atrasada" | "hoje" | "agendada" };

/** 🔴 atrasada / 🟡 hoje / 🟢 agendada — calculado no client (nunca
 * persistido) porque depende só da data de hoje vs. a data salva.
 * Compartilhado entre o card do Kanban e a barra de filtros do Pipeline
 * Comercial (Fase 13).
 *
 * Compara prefixos "YYYY-MM-DD" em vez de reconstruir `Date` locais: um
 * `@db.Date` do Postgres serializa como meia-noite UTC (`toISOString()` em
 * serialize.ts), e `new Date(iso)` + `setHours(0,0,0,0)` reinterpreta esse
 * instante no fuso do navegador — em qualquer fuso a oeste de UTC (ex.:
 * Brasil) isso empurra a data um dia pra trás e marca "Hoje" como
 * "Atrasada". Comparação de string evita qualquer conversão de fuso. */
export function statusProximaAcao(data: string | null): StatusProximaAcao | null {
  if (!data) return null;
  const hojeStr = new Date().toISOString().slice(0, 10);
  const alvoStr = data.slice(0, 10);
  if (alvoStr < hojeStr) return { cor: "bg-destructive", label: "Atrasada", chave: "atrasada" };
  if (alvoStr === hojeStr) return { cor: "bg-amber-500", label: "Hoje", chave: "hoje" };
  return { cor: "bg-emerald-500", label: "Agendada", chave: "agendada" };
}
