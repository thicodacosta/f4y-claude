"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { atualizarAcao, comentarAcao, excluirPdi, registrarRevisao, type RespostaPdi } from "@/lib/pdi/actions";
import { STATUS_ACAO, type StatusAcao } from "@/lib/pdi/calculo";
import { cn } from "@/lib/utils";

const campo = "rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const executar = (fn: () => Promise<RespostaPdi>, aoConcluir?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      if (r.erro) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.ok ?? "Concluído.");
      aoConcluir?.();
      router.refresh();
    });
  return { pendente, executar, router };
}

/** Status e progresso de uma ação (progresso 100 conclui; 0 volta para não iniciada). */
export function AtualizarAcao({ id, status, progresso, rotulo }: { id: string; status: StatusAcao; progresso: number | null; rotulo: string }) {
  const [st, setSt] = useState<StatusAcao>(status);
  const [pr, setPr] = useState(progresso === null ? "" : String(progresso));
  const { pendente, executar } = useAcao();
  const alterado = st !== status || (st === "em_andamento" && pr !== (progresso === null ? "" : String(progresso)));
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      aria-label={`Atualizar ${rotulo}`}
      onSubmit={(e) => {
        e.preventDefault();
        const n = st === "em_andamento" && pr !== "" ? Number(pr) : null;
        if (n !== null && (!Number.isInteger(n) || n < 0 || n > 100)) {
          toast.error("Progresso deve ser um número inteiro de 0 a 100.");
          return;
        }
        executar(() => atualizarAcao(id, st, n));
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Status
        <select name="status" value={st} onChange={(e) => setSt(e.target.value as StatusAcao)} className={cn(campo, "h-9")}>
          {(Object.keys(STATUS_ACAO) as StatusAcao[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_ACAO[s].nome}
            </option>
          ))}
        </select>
      </label>
      {st === "em_andamento" && (
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Progresso (%)
          <input name="progresso" type="number" min={0} max={100} step={1} value={pr} placeholder="50" onChange={(e) => setPr(e.target.value)} className={cn(campo, "h-9 w-24")} />
        </label>
      )}
      <button type="submit" disabled={pendente || !alterado} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
        {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar
      </button>
    </form>
  );
}

export function ComentarAcao({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"comentario" | "fala_colaborador">("comentario");
  const { pendente, executar } = useAcao();
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-strong hover:underline">
        <MessageSquarePlus className="size-4" aria-hidden /> Comentar
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(
          () => comentarAcao(id, tipo, texto),
          () => {
            setTexto("");
            setAberto(false);
          },
        );
      }}
    >
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">Tipo de registro</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`tipo-${id}`} checked={tipo === "comentario"} onChange={() => setTipo("comentario")} className="accent-[var(--primary)]" /> Meu comentário
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`tipo-${id}`} checked={tipo === "fala_colaborador"} onChange={() => setTipo("fala_colaborador")} className="accent-[var(--primary)]" /> Registrar fala do colaborador
        </label>
      </fieldset>
      <textarea aria-label="Comentário" rows={2} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} className={cn(campo, "py-2")} />
      <div className="flex gap-2">
        <button type="submit" disabled={pendente || texto.trim().length < 2} className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
          Registrar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="h-9 px-2 text-sm text-muted-foreground">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function ExcluirPdi({ id, titulo }: { id: string; titulo: string }) {
  const { pendente, executar, router } = useAcao();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!window.confirm(`Excluir o PDI “${titulo}”? Focos, ações, comentários e histórico serão removidos. Esta ação não pode ser desfeita.`)) return;
        executar(() => excluirPdi(id), () => router.push("/pdi"));
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-destructive/40 bg-card px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      <Trash2 className="size-4" aria-hidden /> Excluir
    </button>
  );
}

export function RegistrarRevisao({ id }: { id: string }) {
  const [texto, setTexto] = useState("");
  const { pendente, executar } = useAcao();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => registrarRevisao(id, texto), () => setTexto(""));
      }}
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Registrar revisão
        <textarea name="revisao" rows={3} maxLength={5000} value={texto} onChange={(e) => setTexto(e.target.value)} className={cn(campo, "py-2 font-normal")} placeholder="Avanços, bloqueios e próximos passos" />
      </label>
      <div>
        <button type="submit" disabled={pendente || texto.trim().length < 2} className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
          Registrar
        </button>
      </div>
    </form>
  );
}
