"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContratoDialog } from "@/components/alocacao/contrato-dialog";
import { renovarContrato, encerrarContrato } from "@/modules/alocacao/actions";
import { statusContratoLabel } from "@/modules/alocacao/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// timeZone UTC de propósito: dataInicio/dataFim são colunas @db.Date (sem
// horário) — o Prisma as devolve como meia-noite UTC; formatar no fuso local
// do navegador pode voltar um dia (ex.: America/Sao_Paulo é UTC-3).
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export type ContratoClient = {
  id: string;
  candidatoNome: string;
  rate: number;
  prazoMeses: number;
  dataInicio: string;
  dataFim: string;
  status: string;
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  ativo: "default",
  renovado: "default",
  encerrado: "outline",
};

export function ContratosTab({
  vagaId,
  contratos,
  candidatosDaVaga,
}: {
  vagaId: string;
  contratos: ContratoClient[];
  candidatosDaVaga: { candidatoId: string; nome: string }[];
}) {
  const [novoAberto, setNovoAberto] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNovoAberto(true)}>
          <Plus />
          Novo contrato
        </Button>
      </div>

      {contratos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contrato de alocação ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {contratos.map((c) => (
            <ContratoRow key={c.id} contrato={c} />
          ))}
        </div>
      )}

      <ContratoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        vagaId={vagaId}
        candidatosDaVaga={candidatosDaVaga}
      />
    </div>
  );
}

function ContratoRow({ contrato }: { contrato: ContratoClient }) {
  const [isPending, startTransition] = useTransition();
  const ativo = contrato.status !== "encerrado";

  function renovar() {
    startTransition(async () => {
      try {
        await renovarContrato({ contratoId: contrato.id, prazoMeses: contrato.prazoMeses });
        toast.success("Contrato renovado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível renovar.");
      }
    });
  }

  function encerrar() {
    startTransition(async () => {
      try {
        await encerrarContrato({ contratoId: contrato.id });
        toast.success("Contrato encerrado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível encerrar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{contrato.candidatoNome}</span>
        <span className="text-xs text-muted-foreground">
          {currency.format(contrato.rate)}/mês · {contrato.prazoMeses} meses · {data.format(new Date(contrato.dataInicio))}
          {" – "}
          {data.format(new Date(contrato.dataFim))}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusVariant[contrato.status] ?? "outline"}>
          {statusContratoLabel[contrato.status as keyof typeof statusContratoLabel]}
        </Badge>
        {ativo && (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={renovar}>
              {isPending && <Loader2 className="animate-spin" />}
              Renovar
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={encerrar}>
              Encerrar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
