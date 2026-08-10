"use client";

import { useDraggable } from "@dnd-kit/core";
import { Wallet, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusProximaAcao } from "@/lib/pipeline";
import { Badge } from "@/components/ui/badge";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { OportunidadeClient } from "@/modules/crm/serialize";

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
// timeZone: "UTC" — proximaAcaoData é `@db.Date` (sem hora), serializado como
// meia-noite UTC; formatar no fuso do navegador arrastaria a data exibida um
// dia pra trás em qualquer fuso a oeste de UTC (mesmo motivo do comentário em
// lib/pipeline.ts#statusProximaAcao).
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export function KanbanCard({
  oportunidade,
  onClick,
}: {
  oportunidade: OportunidadeClient;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: oportunidade.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Valor mais avançado conhecido — negociado > proposta > estimado.
  const valorPrincipal = oportunidade.valorNegociado ?? oportunidade.valorProposta ?? oportunidade.valorEstimado;
  const labelValor =
    oportunidade.valorNegociado != null ? "Negociado" : oportunidade.valorProposta != null ? "Proposta" : "Estimado";

  const acao = statusProximaAcao(oportunidade.proximaAcaoData);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm outline-none active:cursor-grabbing",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {oportunidade.empresaLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo externo, sem domínio fixo pra next/image otimizar
            <img src={oportunidade.empresaLogoUrl} alt="" className="size-6 shrink-0 rounded object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold leading-tight">{oportunidade.empresaNome}</span>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Badge variant="secondary">
            {verticalNegocioLabel[oportunidade.vertical as keyof typeof verticalNegocioLabel]}
          </Badge>
          {oportunidade.executiveSearch && <Badge>Executive Search</Badge>}
        </div>
      </div>

      {oportunidade.contatoNome && (
        <div className="flex flex-col">
          <span className="text-xs font-medium">{oportunidade.contatoNome}</span>
          {oportunidade.contatoCargo && <span className="text-xs text-muted-foreground">{oportunidade.contatoCargo}</span>}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
          <Wallet className="size-3.5 text-muted-foreground" />
          {currency.format(valorPrincipal)}
        </span>
        {oportunidade.probabilidade !== null && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{oportunidade.probabilidade}%</span>
        )}
      </div>
      {oportunidade.valorProposta != null && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          {labelValor}: {currency.format(valorPrincipal)}
        </span>
      )}

      {oportunidade.proximaAcao && (
        <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-2 py-1.5">
          <span className="text-xs font-medium">{oportunidade.proximaAcao}</span>
          {oportunidade.proximaAcaoData && acao && (
            <div className="flex items-center gap-1.5">
              <span className={cn("size-1.5 shrink-0 rounded-full", acao.cor)} />
              <Calendar className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {dataCurta.format(new Date(oportunidade.proximaAcaoData))} · {acao.label}
              </span>
            </div>
          )}
        </div>
      )}

      {oportunidade.responsavelNome && (
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {initials(oportunidade.responsavelNome)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{oportunidade.responsavelNome}</span>
        </div>
      )}
    </div>
  );
}
