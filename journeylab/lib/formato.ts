export function formatarData(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T12:00:00`) : iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatarNumero(n: number, casas = 1) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
