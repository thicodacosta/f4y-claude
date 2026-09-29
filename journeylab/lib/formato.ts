import { dataDeTexto, ehDataCivil, FUSO } from "@/lib/datas";

const DIA = { day: "2-digit", month: "short", year: "numeric" } as const;

/** Data por extenso curta. Datas civis (colunas `date`) em UTC; instantes no fuso da aplicação. */
export function formatarData(v: string | Date) {
  if (typeof v === "string") return dataDeTexto(v.slice(0, 10)).toLocaleDateString("pt-BR", { ...DIA, timeZone: "UTC" });
  return v.toLocaleDateString("pt-BR", { ...DIA, timeZone: ehDataCivil(v) ? "UTC" : FUSO });
}

export function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

export function formatarNumero(n: number, casas = 1) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
