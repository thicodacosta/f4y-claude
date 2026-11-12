"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarList, type BarListItem } from "@/components/dashboard/bar-list";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** BarList com corte no topN por padrão — botão "Ver todos" expande pra lista
 * inteira (ex.: Concentração de receita/vagas fechadas em /intelligence, que
 * só mostravam os 5 maiores clientes sem opção de ver o resto). Mesmo padrão
 * de toggle já usado em components/ats/relatorio-pipeline-vagas.tsx.
 * `format` é uma string, não uma função — funções não são serializáveis
 * cruzando a borda Server→Client Component. */
export function BarListExpansivel({
  itemsTop,
  itemsTodos,
  format,
  emptyLabel,
}: {
  itemsTop: BarListItem[];
  itemsTodos: BarListItem[];
  format: "moeda" | "vaga";
  emptyLabel?: string;
}) {
  const [expandido, setExpandido] = useState(false);
  const podeExpandir = itemsTodos.length > itemsTop.length;
  const formatValue = (v: number) => (format === "moeda" ? currency.format(v) : `${v} vaga${v === 1 ? "" : "s"}`);

  return (
    <div className="flex flex-col gap-2">
      <BarList items={expandido ? itemsTodos : itemsTop} formatValue={formatValue} emptyLabel={emptyLabel} />
      {podeExpandir && (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setExpandido((v) => !v)}>
          <ChevronDown className={cn("transition-transform", expandido && "rotate-180")} />
          {expandido ? "Ver menos" : `Ver todos (${itemsTodos.length})`}
        </Button>
      )}
    </div>
  );
}
