"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { alternarAutomacao } from "@/modules/automacoes/actions";

const eventoLabel: Record<string, string> = {
  entrou_etapa: "Ao entrar na etapa",
  vencimento_sla: "SLA estourado",
};

const acaoLabel: Record<string, string> = {
  criar_tarefa: "Cria tarefa",
  notificar: "Notifica",
};

export type AutomacaoClient = {
  id: string;
  nome: string;
  evento: string;
  etapaNome: string | null;
  acao: { tipo: string; params?: Record<string, unknown> };
  ativo: boolean;
  totalExecucoes: number;
};

export function AutomacoesList({ automacoes }: { automacoes: AutomacaoClient[] }) {
  const [items, setItems] = useState(automacoes);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma automação configurada.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => (
        <AutomacaoRow
          key={a.id}
          automacao={a}
          onToggled={(ativo) => setItems((prev) => prev.map((i) => (i.id === a.id ? { ...i, ativo } : i)))}
        />
      ))}
    </div>
  );
}

function AutomacaoRow({
  automacao,
  onToggled,
}: {
  automacao: AutomacaoClient;
  onToggled: (ativo: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function alternar() {
    const novoAtivo = !automacao.ativo;
    onToggled(novoAtivo);
    startTransition(async () => {
      try {
        await alternarAutomacao(automacao.id, novoAtivo);
        toast.success(novoAtivo ? "Automação ativada." : "Automação desativada.");
      } catch (err) {
        onToggled(!novoAtivo);
        toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a automação.");
      }
    });
  }

  const acaoTipo = acaoLabel[automacao.acao.tipo] ?? automacao.acao.tipo;
  const titulo = (automacao.acao.params?.titulo as string | undefined) ?? null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{automacao.nome}</span>
          <Badge variant={automacao.ativo ? "default" : "outline"}>{automacao.ativo ? "Ativa" : "Inativa"}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {eventoLabel[automacao.evento] ?? automacao.evento}
          {automacao.etapaNome ? ` · ${automacao.etapaNome}` : ""} · {acaoTipo}
          {titulo ? ` — "${titulo}"` : ""}
        </span>
        <span className="text-xs text-muted-foreground">{automacao.totalExecucoes} execuções até agora</span>
      </div>
      <Button size="sm" variant="outline" disabled={isPending} onClick={alternar}>
        {isPending ? <Loader2 className="animate-spin" /> : automacao.ativo ? <ZapOff /> : <Zap />}
        {automacao.ativo ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
