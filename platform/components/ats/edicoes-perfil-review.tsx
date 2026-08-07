"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { aprovarEdicaoPerfil, rejeitarEdicaoPerfil } from "@/modules/ats/actions";

export type EdicaoPerfilClient = {
  id: string;
  campos: Record<string, unknown>;
  status: string;
  criadoEm: string;
};

const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  pendente: "secondary",
  aprovada: "default",
  rejeitada: "outline",
};

const statusLabel: Record<string, string> = {
  pendente: "Aguardando revisão",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export function EdicoesPerfilReview({ edicoes }: { edicoes: EdicaoPerfilClient[] }) {
  const [isPending, startTransition] = useTransition();

  if (edicoes.length === 0) return null;

  function aprovar(id: string) {
    startTransition(async () => {
      try {
        await aprovarEdicaoPerfil(id);
        toast.success("Edição aprovada e aplicada ao perfil.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível aprovar.");
      }
    });
  }

  function rejeitar(id: string) {
    startTransition(async () => {
      try {
        await rejeitarEdicaoPerfil(id);
        toast.success("Edição rejeitada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível rejeitar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-heading text-lg font-semibold">Edições de perfil propostas pelo candidato</h2>
      <div className="flex flex-col gap-2">
        {edicoes.map((e) => (
          <div key={e.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(e.criadoEm),
                )}
              </span>
              <Badge variant={statusVariant[e.status]}>{statusLabel[e.status]}</Badge>
            </div>
            <div className="flex flex-col gap-0.5">
              {Object.entries(e.campos)
                .filter(([, valor]) => valor !== undefined && valor !== "")
                .map(([campo, valor]) => (
                  <p key={campo}>
                    <span className="font-medium">{campo}: </span>
                    {Array.isArray(valor) ? valor.join(", ") : String(valor)}
                  </p>
                ))}
            </div>
            {e.status === "pendente" && (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => rejeitar(e.id)}>
                  {isPending ? <Loader2 className="animate-spin" /> : <X />}
                  Rejeitar
                </Button>
                <Button size="sm" disabled={isPending} onClick={() => aprovar(e.id)}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Check />}
                  Aprovar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
