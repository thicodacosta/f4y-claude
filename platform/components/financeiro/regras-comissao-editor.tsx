"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { atualizarRegraComissao } from "@/modules/financeiro/actions";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { VerticalNegocio } from "@/lib/generated/prisma/client";

type Regra = { id: string; vertical: VerticalNegocio; percentualConsultor: number; percentualRecrutador: number };

export function RegrasComissaoEditor({ regras }: { regras: Regra[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Percentual aplicado sobre o valor da oportunidade/vaga ao fechar, por vertical — só admin edita.
      </p>
      {regras.map((r) => (
        <RegraRow key={r.id} regra={r} />
      ))}
    </div>
  );
}

function RegraRow({ regra }: { regra: Regra }) {
  const [consultor, setConsultor] = useState(String(regra.percentualConsultor));
  const [recrutador, setRecrutador] = useState(String(regra.percentualRecrutador));
  const [isPending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      try {
        await atualizarRegraComissao({
          vertical: regra.vertical,
          percentualConsultor: consultor,
          percentualRecrutador: recrutador,
        });
        toast.success("Regra atualizada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a regra.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
      <span className="min-w-32 text-sm font-medium">{verticalNegocioLabel[regra.vertical]}</span>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`consultor-${regra.id}`} className="text-xs text-muted-foreground">
          Consultor (oportunidade)
        </Label>
        <Input
          id={`consultor-${regra.id}`}
          type="number"
          min={0}
          max={100}
          step="0.1"
          className="w-24"
          value={consultor}
          onChange={(e) => setConsultor(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`recrutador-${regra.id}`} className="text-xs text-muted-foreground">
          Recrutador (vaga)
        </Label>
        <Input
          id={`recrutador-${regra.id}`}
          type="number"
          min={0}
          max={100}
          step="0.1"
          className="w-24"
          value={recrutador}
          onChange={(e) => setRecrutador(e.target.value)}
        />
      </div>
      <Button size="sm" variant="outline" disabled={isPending} onClick={salvar}>
        {isPending && <Loader2 className="animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}
