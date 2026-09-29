"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Ban, CheckCircle2, CircleDot, Clock, GripVertical, Loader2, Play, RotateCcw, Unlock } from "lucide-react";
import { moverTarefa } from "@/lib/onboarding/actions";
import { COLUNAS_KANBAN, RESPONSAVEL, STATUS_TAREFA, type StatusTarefa } from "@/lib/onboarding/calculo";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Tarefa serializada para o cliente (datas como "YYYY-MM-DD"). */
export type TarefaCliente = {
  id: string;
  titulo: string;
  fase: string;
  status: StatusTarefa;
  responsavelTipo: "rh" | "gestor" | "colaborador";
  responsavelNome: string | null;
  prazo: string;
  prazoRotulo: string;
  bloqueioMotivo: string | null;
  obrigatoria: boolean;
  sinais: { atrasada: boolean; venceHoje: boolean; proxima: boolean; bloqueada: boolean };
  podeAtualizar: boolean;
};

type Pedido = { tarefa: TarefaCliente; status: StatusTarefa } | null;

/** Executa a mudança pelo MESMO caminho do servidor (validação, transação e recálculo únicos). */
function useMover() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  function mover(tarefaId: string, status: StatusTarefa, motivo?: string, aoFalhar?: () => void) {
    iniciar(async () => {
      const r = await moverTarefa(tarefaId, status, motivo);
      if (r.erro) {
        toast.error(r.erro);
        aoFalhar?.();
        return;
      }
      toast.success(r.status === "concluido" ? "Tarefa atualizada — onboarding concluído!" : `${r.ok} Progresso: ${r.progresso}%.`);
      router.refresh();
    });
  }
  return { mover, pendente };
}

/** Diálogo de motivo (bloquear/dispensar). */
function DialogoMotivo({ pedido, aoFechar, aoConfirmar }: { pedido: Pedido; aoFechar: () => void; aoConfirmar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const dispensar = pedido?.status === "dispensada";
  return (
    <Dialog
      open={!!pedido}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setMotivo("");
          aoFechar();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dispensar ? "Dispensar tarefa" : "Bloquear tarefa"}</DialogTitle>
          <DialogDescription>
            {pedido?.tarefa.titulo} — {dispensar ? "a tarefa deixa de contar no progresso." : "a tarefa continua pendente e aparece nos alertas."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (motivo.trim().length < 3) return;
            aoConfirmar(motivo.trim());
            setMotivo("");
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="motivo-tarefa" className="text-[13px] font-semibold text-foreground/85">
            Motivo
          </label>
          <textarea
            id="motivo-tarefa"
            required
            minLength={3}
            maxLength={500}
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <button type="button" onClick={aoFechar} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
              Cancelar
            </button>
            <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              {dispensar ? "Dispensar" : "Bloquear"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const BOTAO = "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50";

/** Ações rápidas de uma tarefa (iniciar, bloquear, desbloquear, concluir, reabrir, dispensar/restaurar). */
export function AcoesRapidas({ tarefa, podeDispensar }: { tarefa: TarefaCliente; podeDispensar: boolean }) {
  const { mover, pendente } = useMover();
  const [pedido, setPedido] = useState<Pedido>(null);
  if (!tarefa.podeAtualizar) return null;
  const s = tarefa.status;
  const acao = (status: StatusTarefa) => () => (status === "bloqueada" || status === "dispensada" ? setPedido({ tarefa, status }) : mover(tarefa.id, status));
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-busy={pendente}>
      {pendente && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Salvando" />}
      {s === "nao_iniciada" && (
        <button type="button" className={BOTAO} disabled={pendente} onClick={acao("em_andamento")}>
          <Play className="size-3.5" aria-hidden /> Iniciar
        </button>
      )}
      {(s === "nao_iniciada" || s === "em_andamento") && (
        <>
          <button type="button" className={cn(BOTAO, "border-teal/40 text-teal-strong")} disabled={pendente} onClick={acao("concluida")}>
            <CheckCircle2 className="size-3.5" aria-hidden /> Concluir
          </button>
          <button type="button" className={BOTAO} disabled={pendente} onClick={acao("bloqueada")}>
            <Ban className="size-3.5" aria-hidden /> Bloquear
          </button>
        </>
      )}
      {s === "bloqueada" && (
        <button type="button" className={BOTAO} disabled={pendente} onClick={acao("em_andamento")}>
          <Unlock className="size-3.5" aria-hidden /> Desbloquear
        </button>
      )}
      {s === "concluida" && (
        <button type="button" className={BOTAO} disabled={pendente} onClick={acao("em_andamento")}>
          <RotateCcw className="size-3.5" aria-hidden /> Reabrir
        </button>
      )}
      {podeDispensar && s !== "dispensada" && s !== "concluida" && (
        <button type="button" className={cn(BOTAO, "text-muted-foreground")} disabled={pendente} onClick={acao("dispensada")}>
          Dispensar
        </button>
      )}
      {podeDispensar && s === "dispensada" && (
        <button type="button" className={BOTAO} disabled={pendente} onClick={acao("nao_iniciada")}>
          <RotateCcw className="size-3.5" aria-hidden /> Restaurar
        </button>
      )}
      <DialogoMotivo
        pedido={pedido}
        aoFechar={() => setPedido(null)}
        aoConfirmar={(motivo) => {
          if (pedido) mover(pedido.tarefa.id, pedido.status, motivo);
          setPedido(null);
        }}
      />
    </div>
  );
}

export function SinaisTarefa({ sinais, className }: { sinais: TarefaCliente["sinais"]; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {sinais.atrasada && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
          <AlertTriangle className="size-3" aria-hidden /> Atrasada
        </span>
      )}
      {sinais.venceHoje && <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground dark:text-warning">Vence hoje</span>}
      {sinais.proxima && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Clock className="size-3" aria-hidden /> Próxima do prazo
        </span>
      )}
      {sinais.bloqueada && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
          <Ban className="size-3" aria-hidden /> Bloqueada
        </span>
      )}
    </span>
  );
}

const ICONE_COLUNA: Record<StatusTarefa, typeof CircleDot> = { nao_iniciada: CircleDot, em_andamento: Play, bloqueada: Ban, concluida: CheckCircle2, dispensada: CircleDot };

/**
 * Kanban de tarefas. Arrastar persiste no banco pelo mesmo `moverTarefa` dos
 * botões; em caso de erro o cartão volta à coluna de origem. Para teclado e
 * telas de toque, cada cartão tem as mesmas ações rápidas.
 */
export function KanbanTarefas({ tarefas, podeDispensar }: { tarefas: TarefaCliente[]; podeDispensar: boolean }) {
  const [local, setLocal] = useState(tarefas);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<StatusTarefa | null>(null);
  const [pedido, setPedido] = useState<Pedido>(null);
  const { mover } = useMover();
  // Dados novos do servidor (após router.refresh) substituem o estado otimista.
  const [origem, setOrigem] = useState(tarefas);
  if (origem !== tarefas) {
    setOrigem(tarefas);
    setLocal(tarefas);
  }

  function soltar(status: StatusTarefa, idDoEvento: string) {
    setSobre(null);
    // O id vem do próprio evento de arrastar (o estado pode ainda não ter sido atualizado).
    const id = idDoEvento || arrastando;
    const t = local.find((x) => x.id === id);
    setArrastando(null);
    if (!t || t.status === status) return;
    if (!t.podeAtualizar) {
      toast.error(t.responsavelTipo === "rh" ? "Tarefas de RH são atualizadas pelo RH." : "Você não pode atualizar esta tarefa.");
      return;
    }
    if (status === "bloqueada") {
      setPedido({ tarefa: t, status });
      return;
    }
    aplicar(t, status);
  }

  function aplicar(t: TarefaCliente, status: StatusTarefa, motivo?: string) {
    const anterior = local;
    setLocal((l) => l.map((x) => (x.id === t.id ? { ...x, status, bloqueioMotivo: status === "bloqueada" ? (motivo ?? null) : null } : x)));
    mover(t.id, status, motivo, () => setLocal(anterior));
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUNAS_KANBAN.map((col) => {
          const Icone = ICONE_COLUNA[col];
          const cartoes = local.filter((t) => t.status === col);
          return (
            <section
              key={col}
              aria-label={`${STATUS_TAREFA[col].nome} (${cartoes.length})`}
              data-coluna={col}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(col);
              }}
              onDragLeave={() => setSobre((s) => (s === col ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                soltar(col, e.dataTransfer.getData("text/plain"));
              }}
              className={cn(
                "flex min-h-40 flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 transition-colors",
                sobre === col && "border-teal bg-teal-soft",
              )}
            >
              <header className="flex items-center justify-between px-1">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Icone className="size-4 text-muted-foreground" aria-hidden /> {STATUS_TAREFA[col].nome}
                </h4>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{cartoes.length}</span>
              </header>
              {cartoes.map((t) => (
                <article
                  key={t.id}
                  data-tarefa={t.id}
                  draggable={t.podeAtualizar}
                  onDragStart={(e) => {
                    setArrastando(t.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.id);
                  }}
                  onDragEnd={() => setArrastando(null)}
                  className={cn(
                    "flex flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-surface",
                    t.podeAtualizar && "cursor-grab active:cursor-grabbing",
                    arrastando === t.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {t.podeAtualizar && <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-medium">{t.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.fase} · {RESPONSAVEL[t.responsavelTipo]}
                        {t.responsavelNome ? ` (${t.responsavelNome})` : ""} · {t.prazoRotulo}
                      </p>
                      {t.bloqueioMotivo && <p className="mt-1 text-xs text-destructive">Bloqueio: {t.bloqueioMotivo}</p>}
                    </div>
                  </div>
                  <SinaisTarefa sinais={t.sinais} />
                  <AcoesRapidas tarefa={t} podeDispensar={podeDispensar} />
                </article>
              ))}
              {cartoes.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Arraste tarefas para cá</p>}
            </section>
          );
        })}
      </div>
      <DialogoMotivo
        pedido={pedido}
        aoFechar={() => setPedido(null)}
        aoConfirmar={(motivo) => {
          if (pedido) aplicar(pedido.tarefa, pedido.status, motivo);
          setPedido(null);
        }}
      />
    </>
  );
}
