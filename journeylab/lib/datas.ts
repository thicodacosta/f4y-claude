/**
 * Datas civis (colunas `date` do banco) × instantes (timestamps).
 *
 * Colunas `date` chegam do Prisma como Date às 00:00 UTC. Formatar ou comparar
 * esses valores no fuso local desloca um dia (03/11 vira 02/11 em São Paulo).
 * Regra única: datas civis são sempre tratadas em UTC; "hoje" é a data civil
 * no fuso da aplicação, convertida para 00:00 UTC — assim comparações com
 * colunas `date` são exatas em qualquer servidor (inclusive servidores em UTC).
 */
export const FUSO = "America/Sao_Paulo";
const DIA_MS = 86_400_000;

/** "YYYY-MM-DD" de hoje no fuso da aplicação. */
export function hojeTexto(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Texto "YYYY-MM-DD" → Date 00:00 UTC (formato das colunas `date`). */
export function dataDeTexto(texto: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error("Data inválida.");
  const d = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto) throw new Error("Data inválida.");
  return d;
}

/** Date de coluna `date` → "YYYY-MM-DD" (sem conversão de fuso). */
export function textoDeData(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Hoje (data civil no fuso da aplicação) como 00:00 UTC — comparável com colunas `date`. */
export function hoje(agora = new Date()) {
  return dataDeTexto(hojeTexto(agora));
}

export function somarDias(d: Date, dias: number) {
  return new Date(d.getTime() + dias * DIA_MS);
}

/** Dias inteiros de `a` até `b` (ambos datas civis). */
export function diasEntre(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DIA_MS);
}

/** É uma data civil (00:00:00.000 UTC)? Timestamps reais praticamente nunca caem exatamente aí. */
export function ehDataCivil(d: Date) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** "YYYY-MM-DDTHH:mm" digitado no fuso da aplicação → instante correto (independe do fuso do servidor). */
export function instanteNoFuso(texto: string) {
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) throw new Error("Data e hora inválidas.");
  const [, a, me, d, h, mi] = m.map(Number);
  const comoUtc = Date.UTC(a, me - 1, d, h, mi);
  // Diferença entre o relógio do fuso e UTC naquele instante (considera horário de verão, se houver).
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(comoUtc))
      .map((p) => [p.type, p.value]),
  );
  const relogio = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute);
  return new Date(comoUtc - (relogio - comoUtc));
}
