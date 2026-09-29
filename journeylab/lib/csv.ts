/** Célula CSV segura: neutraliza fórmulas (CSV injection) e escapa aspas. */
export const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
};

/** Arquivo CSV (separador ";", BOM para abrir corretamente no Excel em PT-BR). */
export function respostaCsv(linhas: unknown[][], nome: string) {
  const corpo = linhas.map((l) => l.map(csv).join(";")).join("\r\n");
  return new Response("﻿" + corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
