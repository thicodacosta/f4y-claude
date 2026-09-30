"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, EyeOff, Loader2, Lock, RotateCcw, Send, UserCheck } from "lucide-react";
import { assumirNotificacoes, despublicarVaga, encerrarVaga, publicarVaga, reabrirVaga, reenviarAviso, type RespostaVaga } from "@/lib/carreiras/actions";
import { cn } from "@/lib/utils";

function useExecutar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const executar = (fn: () => Promise<RespostaVaga>) =>
    iniciar(async () => {
      const r = await fn();
      if (r.erro) toast.error(r.erro);
      else {
        toast.success(r.ok ?? "Concluído.");
        router.refresh();
      }
    });
  return { pendente, executar };
}

const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-50";

export function CopiarLink({ caminho, rotulo = "Copiar link" }: { caminho: string; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${caminho}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copiado.");
        } catch {
          toast.error(`Não foi possível copiar. Link: ${url}`);
        }
      }}
      className={cn(btn, "border border-border bg-card hover:bg-muted")}
    >
      <Copy className="size-4" aria-hidden /> {rotulo}
    </button>
  );
}

/** Publicação com conferência explícita do e-mail que receberá os avisos de candidatura. */
export function PublicarVaga({ id, email }: { id: string; email: string | null }) {
  const [confirmado, setConfirmado] = useState(false);
  const { pendente, executar } = useExecutar();
  if (!email)
    return (
      <div className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        <p>Esta vaga não tem um e-mail válido do criador para receber as candidaturas. Para publicar, assuma os avisos com o seu e-mail.</p>
        <div>
          <AssumirNotificacoes id={id} />
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          Confirmo que os avisos de candidatura desta vaga devem ir para <strong>{email}</strong>.
        </span>
      </label>
      <div>
        <button type="button" disabled={!confirmado || pendente} onClick={() => executar(() => publicarVaga(id, email))} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Publicar na Página de Carreiras
        </button>
      </div>
    </div>
  );
}

export function AssumirNotificacoes({ id }: { id: string }) {
  const { pendente, executar } = useExecutar();
  return (
    <button type="button" disabled={pendente} onClick={() => executar(() => assumirNotificacoes(id))} className={cn(btn, "border border-border bg-card hover:bg-muted")}>
      <UserCheck className="size-4" aria-hidden /> Receber os avisos no meu e-mail
    </button>
  );
}

const ACOES = {
  despublicar: { fn: despublicarVaga, rotulo: "Despublicar", icone: EyeOff, confirmar: "Retirar a vaga da Página de Carreiras? Ela deixa de receber candidaturas." },
  encerrar: { fn: encerrarVaga, rotulo: "Encerrar vaga", icone: Lock, confirmar: "Encerrar a vaga? Ela sai da página pública; candidaturas e histórico são mantidos." },
  reabrir: { fn: reabrirVaga, rotulo: "Reabrir", icone: RotateCcw, confirmar: null },
} as const;

export function BotaoVaga({ acao, id }: { acao: keyof typeof ACOES; id: string }) {
  const { pendente, executar } = useExecutar();
  const a = ACOES[acao];
  const Icone = a.icone;
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (a.confirmar && !window.confirm(a.confirmar)) return;
        executar(() => a.fn(id));
      }}
      className={cn(btn, acao === "encerrar" ? "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10" : "border border-border bg-card hover:bg-muted")}
    >
      {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icone className="size-4" aria-hidden />} {a.rotulo}
    </button>
  );
}

export function ReenviarAviso({ id }: { id: string }) {
  const { pendente, executar } = useExecutar();
  return (
    <button type="button" disabled={pendente} onClick={() => executar(() => reenviarAviso(id))} className="inline-flex items-center gap-1 text-xs font-medium text-teal-strong hover:underline disabled:opacity-50">
      {pendente && <Loader2 className="size-3 animate-spin" aria-hidden />} Reenviar aviso
    </button>
  );
}
