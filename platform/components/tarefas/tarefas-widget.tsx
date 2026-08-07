"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { concluirTarefa } from "@/modules/tarefas/actions";

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export type TarefaClient = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  status: string;
  origem: string;
};

export function TarefasWidget({ tarefas }: { tarefas: TarefaClient[] }) {
  const [items, setItems] = useState(tarefas);
  const [, startTransition] = useTransition();

  const pendentes = items.filter((t) => t.status === "pendente");

  function concluir(id: string) {
    const anterior = items;
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "concluida" } : t)));
    startTransition(async () => {
      try {
        await concluirTarefa(id);
      } catch (err) {
        setItems(anterior);
        toast.error(err instanceof Error ? err.message : "Não foi possível concluir a tarefa.");
      }
    });
  }

  if (pendentes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente. 🎉</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {pendentes.map((t) => {
        const atrasada = t.prazo && new Date(t.prazo) < new Date();
        return (
          <div key={t.id} className="flex items-start gap-2.5 rounded-md border border-border p-2.5 text-sm">
            <button
              onClick={() => concluir(t.id)}
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-transparent hover:border-primary hover:text-primary"
              aria-label="Concluir tarefa"
            >
              <Check className="size-3" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{t.titulo}</span>
              {t.descricao && <span className="text-xs text-muted-foreground">{t.descricao}</span>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {t.prazo && (
                  <span className={cn(atrasada && "font-medium text-destructive")}>
                    Prazo: {data.format(new Date(t.prazo))}
                  </span>
                )}
                {t.origem === "automacao" && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3" />
                    Automação
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
