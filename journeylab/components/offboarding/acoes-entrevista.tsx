"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, MessageSquareText, XCircle } from "lucide-react";
import { toast } from "sonner";
import { dispensarEntrevista, enviarEntrevista } from "@/lib/offboarding/actions";
import { FormularioEntrevista } from "./formulario-entrevista";

/** Enviar link, conduzir a entrevista agora ou marcar como não realizada. */
export function AcoesEntrevista({ id, emailSugerido, jaEnviada }: { id: string; emailSugerido: string; jaEnviada: boolean }) {
  const [email, setEmail] = useState(emailSugerido);
  const [conduzir, setConduzir] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await enviarEntrevista(id, email);
            if (r.erro) toast.error(r.erro);
            else toast.success(r.ok);
          });
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-semibold">
          E-mail para o link da entrevista
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <button type="submit" disabled={pendente} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />} {jaEnviada ? "Reenviar link" : "Enviar link"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setConduzir((x) => !x)} aria-expanded={conduzir} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
          <MessageSquareText className="size-4" aria-hidden /> {conduzir ? "Fechar formulário" : "Registrar entrevista conduzida pelo RH"}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            const motivo = window.prompt("Por que a entrevista não será realizada? (ex.: a pessoa recusou)");
            if (!motivo?.trim()) return;
            iniciar(async () => {
              const r = await dispensarEntrevista(id, motivo);
              if (r.erro) toast.error(r.erro);
              else toast.success(r.ok);
            });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          <XCircle className="size-4" aria-hidden /> Não será realizada
        </button>
      </div>
      {conduzir && <FormularioEntrevista modo="interno" desligamentoId={id} />}
    </div>
  );
}
