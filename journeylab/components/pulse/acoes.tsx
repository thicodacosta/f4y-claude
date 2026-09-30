"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Copy, CopyPlus, Loader2, Lock, Save, Send, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { duplicarPesquisa, encerrarPesquisa, enviarLembretes, enviarPesquisa, excluirRascunho, gerarInsights, salvarComoModelo, type RespostaAcao } from "@/lib/pulse/actions";
import { cn } from "@/lib/utils";

const ACOES = {
  enviar: { fn: enviarPesquisa, rotulo: "Enviar agora", icone: Send, confirmar: "Enviar a pesquisa? Depois de enviada, as perguntas não podem mais ser alteradas." },
  duplicar: { fn: duplicarPesquisa, rotulo: "Duplicar", icone: CopyPlus, confirmar: null },
  encerrar: { fn: encerrarPesquisa, rotulo: "Encerrar", icone: Lock, confirmar: "Encerrar a pesquisa? Ninguém mais poderá responder." },
  lembretes: { fn: enviarLembretes, rotulo: "Enviar lembrete", icone: BellRing, confirmar: "Enviar lembrete por e-mail para quem ainda não respondeu?" },
  insights: { fn: gerarInsights, rotulo: "Gerar insights", icone: Sparkles, confirmar: null },
  excluir: { fn: excluirRascunho, rotulo: "Excluir rascunho", icone: Trash2, confirmar: "Excluir este rascunho? Esta ação não pode ser desfeita." },
} satisfies Record<string, { fn: (id: string) => Promise<RespostaAcao>; rotulo: string; icone: LucideIcon; confirmar: string | null }>;

const estilo = {
  primario: "bg-primary text-primary-foreground hover:bg-primary/90",
  contorno: "border border-border bg-card hover:bg-muted",
  perigo: "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10",
};

function avisar(r: RespostaAcao) {
  if (r.erro) return toast.error(r.erro);
  if (r.envio) {
    const { enviados, falhas, semEmail } = r.envio;
    const extra = [falhas.length ? `${falhas.length} falha(s): ${falhas.slice(0, 3).map((f) => `${f.nome} (${f.motivo})`).join("; ")}` : "", semEmail ? `${semEmail} sem e-mail cadastrado` : ""].filter(Boolean).join(" · ");
    return (falhas.length ? toast.warning : toast.success)(`${r.ok ?? ""} ${enviados} e-mail(s) enviado(s).${extra ? ` ${extra}` : ""}`.trim());
  }
  toast.success(r.ok ?? "Concluído.");
}

export function BotaoPesquisa({ acao, id, variante = "contorno", compacto, aoConcluir }: { acao: keyof typeof ACOES; id: string; variante?: keyof typeof estilo; compacto?: boolean; aoConcluir?: "abrir" | "lista" }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const a = ACOES[acao];
  const Icone = a.icone;
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (a.confirmar && !window.confirm(a.confirmar)) return;
        iniciar(async () => {
          const r = await a.fn(id);
          avisar(r);
          if (r.erro) return;
          if (aoConcluir === "abrir" && r.id) router.push(`/pulse/${r.id}`);
          else if (aoConcluir === "lista") router.push("/pulse");
          else router.refresh();
        });
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-lg font-medium disabled:opacity-50", compacto ? "h-8 px-2.5 text-xs" : "h-10 px-4 text-sm", estilo[variante])}
    >
      {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icone className="size-4" aria-hidden />}
      {a.rotulo}
    </button>
  );
}

export function CopiarLink({ url, compacto }: { url: string; compacto?: boolean }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copiado.");
        } catch {
          toast.error("Não foi possível copiar. Link: " + url);
        }
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-medium hover:bg-muted", compacto ? "h-8 px-2.5 text-xs" : "h-10 px-4 text-sm")}
    >
      <Copy className="size-4" aria-hidden /> Copiar link
    </button>
  );
}

export function SalvarModelo({ id, sugestao }: { id: string; sugestao: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(sugestao);
  const [pendente, iniciar] = useTransition();
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
        <Save className="size-4" aria-hidden /> Salvar como template
      </button>
    );
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await salvarComoModelo(id, nome);
          avisar(r);
          if (!r.erro) setAberto(false);
        });
      }}
    >
      <input aria-label="Nome do template" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} className="h-10 w-56 rounded-lg border border-input bg-background px-3 text-sm" />
      <button type="submit" disabled={pendente} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        Salvar
      </button>
      <button type="button" onClick={() => setAberto(false)} className="h-10 px-2 text-sm text-muted-foreground">
        Cancelar
      </button>
    </form>
  );
}
