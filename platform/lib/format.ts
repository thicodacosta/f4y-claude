/** Só o mês (sem ano) — pra eixos de gráfico onde o ano não cabe/não
 * precisa repetir em cada tick. Use `formatMesAno` quando o rótulo aparece
 * sozinho (tabela, badge, cabeçalho de grupo). */
export const MES_LABEL: Record<string, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

/** `mes` no formato "YYYY-MM" (o mesmo bucket usado pelas queries de série
 * mensal em modules/dashboard e modules/ats). */
export function formatMesAno(mes: string) {
  const [ano, m] = mes.split("-");
  return `${MES_LABEL[m] ?? m}/${ano}`;
}
