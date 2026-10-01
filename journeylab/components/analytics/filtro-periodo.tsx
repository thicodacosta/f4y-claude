"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { PERIODOS } from "@/lib/analytics/calculo";

const campo = "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Filtro por tempo (GET: URL compartilhável). Datas só no período personalizado. */
export function FiltroPeriodo({
  periodo,
  de,
  ate,
  area,
  areas,
  extras,
}: {
  periodo: string;
  de: string;
  ate: string;
  area?: string | null;
  areas?: { id: string; nome: string }[];
  extras?: React.ReactNode;
}) {
  const [p, setP] = useState(periodo);
  return (
    <form role="search" aria-label="Filtros de período" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="f-periodo" className="text-xs font-semibold text-muted-foreground">
          Período
        </label>
        <select id="f-periodo" name="periodo" value={p} onChange={(e) => setP(e.target.value)} className={campo}>
          {Object.entries(PERIODOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {p === "personalizado" && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-de" className="text-xs font-semibold text-muted-foreground">
              De
            </label>
            <input id="f-de" type="date" name="de" defaultValue={de} className={campo} required />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-ate" className="text-xs font-semibold text-muted-foreground">
              Até
            </label>
            <input id="f-ate" type="date" name="ate" defaultValue={ate} className={campo} required />
          </div>
        </>
      )}
      {areas && areas.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="f-area" className="text-xs font-semibold text-muted-foreground">
            Área
          </label>
          <select id="f-area" name="area" defaultValue={area ?? ""} className={campo}>
            <option value="">Organização inteira</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      {extras}
      <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <CalendarRange className="size-4" aria-hidden /> Aplicar
      </button>
    </form>
  );
}
