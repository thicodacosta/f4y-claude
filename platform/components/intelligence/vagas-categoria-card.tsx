"use client";

import { useState } from "react";
import { Briefcase, ArrowLeftRight } from "lucide-react";

const UNIDADES = [
  { chave: "recrutamento" as const, label: "Recrutamento & Seleção" },
  { chave: "alocacao" as const, label: "Alocação" },
];

/** Troca entre o total de vagas (todos os status) de Recrutamento &
 * Seleção e de Alocação — substituiu o card "Capacidade Alocação" em
 * /intelligence, que só cobria uma das duas verticais. */
export function VagasCategoriaCard({ vagas }: { vagas: { alocacao: number; recrutamento: number } }) {
  const [indice, setIndice] = useState(0);
  const unidade = UNIDADES[indice];

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Briefcase className="size-3.5" />
          Vagas — {unidade.label}
        </div>
        <button
          type="button"
          onClick={() => setIndice((i) => (i + 1) % UNIDADES.length)}
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Trocar unidade de negócio"
        >
          <ArrowLeftRight className="size-3.5" />
        </button>
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums">{vagas[unidade.chave]}</span>
      <span className="text-xs text-muted-foreground">vagas no total</span>
    </div>
  );
}
