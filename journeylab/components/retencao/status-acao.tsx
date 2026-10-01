"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { alterarStatusAcaoRetencao } from "@/lib/retencao-talentos/actions";

const OPCOES = { planejada: "Planejada", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" } as const;
type Status = keyof typeof OPCOES;

/** Situação da ação; concluir pede o resultado observado. */
export function StatusAcaoRetencao({ id, status, titulo }: { id: string; status: Status; titulo: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <select
      aria-label={`Situação de ${titulo}`}
      value={status}
      disabled={pendente}
      onChange={(e) => {
        const novo = e.target.value as Status;
        let resultado: string | undefined;
        if (novo === "concluida") {
          resultado = window.prompt("Qual foi o resultado observado? (obrigatório)") ?? undefined;
          if (!resultado?.trim()) {
            e.target.value = status;
            return;
          }
        }
        iniciar(async () => {
          const r = await alterarStatusAcaoRetencao(id, novo, resultado);
          if (r.erro) toast.error(r.erro);
          else toast.success(r.ok);
        });
      }}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      {Object.entries(OPCOES).map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select>
  );
}
