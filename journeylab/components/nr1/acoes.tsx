"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Loader2, Lock, Mail, Play, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import {
  adicionarAcaoNr1,
  alterarStatusRiscoNr1,
  aprovarSugestoesNr1,
  ativarDiagnostico,
  atualizarAcaoNr1,
  encerrarDiagnostico,
  enviarConvitesPendentes,
  enviarLembreteNr1,
  excluirRascunhoNr1,
  gerarSugestoesNr1,
  registrarRiscoNr1,
  revisarMatriz,
  type RespostaNr1,
  type SugestoesNr1,
} from "@/lib/nr1/actions";
import { SEVERIDADE } from "@/lib/nr1/calculo";
import { cn } from "@/lib/utils";

const campo = "rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function avisar(r: RespostaNr1) {
  if (r.erro) return toast.error(r.erro);
  if (r.envio) {
    const { enviados, falhas, semEmail } = r.envio;
    const extra = [falhas.length ? `${falhas.length} falha(s): ${falhas.slice(0, 3).map((f) => `${f.nome} (${f.motivo})`).join("; ")}` : "", semEmail ? `${semEmail} sem e-mail cadastrado` : ""].filter(Boolean).join(" · ");
    return (falhas.length || semEmail ? toast.warning : toast.success)(`${r.ok ?? ""} ${enviados} convite(s) enviado(s).${extra ? ` ${extra}` : ""}`.trim());
  }
  toast.success(r.ok ?? "Concluído.");
}

function useExecutar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const executar = (fn: () => Promise<RespostaNr1>, depois?: (r: RespostaNr1) => void) =>
    iniciar(async () => {
      const r = await fn();
      avisar(r);
      if (!r.erro) {
        depois?.(r);
        router.refresh();
      }
    });
  return { pendente, executar, router };
}

const ACOES = {
  ativar_enviar: { rotulo: "Ativar e enviar convites", icone: Play, confirmar: "Ativar a pesquisa e enviar os convites por e-mail? Depois de ativada, questionário e audiência não mudam.", fn: (id: string) => ativarDiagnostico(id, true) },
  ativar: { rotulo: "Ativar sem enviar e-mails", icone: Play, confirmar: "Ativar sem enviar e-mails agora? Você poderá enviar os convites depois.", fn: (id: string) => ativarDiagnostico(id, false) },
  enviar: { rotulo: "Enviar convites pendentes", icone: Mail, confirmar: null, fn: enviarConvitesPendentes },
  lembrete: { rotulo: "Enviar lembrete", icone: BellRing, confirmar: "Enviar lembrete a quem ainda não usou o convite? A lista não é exibida para preservar o anonimato.", fn: enviarLembreteNr1 },
  encerrar: { rotulo: "Encerrar", icone: Lock, confirmar: "Encerrar a pesquisa? Ninguém mais poderá responder.", fn: encerrarDiagnostico },
  excluir: { rotulo: "Excluir rascunho", icone: Trash2, confirmar: "Excluir este rascunho?", fn: excluirRascunhoNr1 },
  ia: { rotulo: "Gerar sugestões de análise e plano de ação", icone: Sparkles, confirmar: null, fn: gerarSugestoesNr1 },
} satisfies Record<string, { rotulo: string; icone: LucideIcon; confirmar: string | null; fn: (id: string) => Promise<RespostaNr1> }>;

export function BotaoNr1({ acao, id, variante = "contorno" }: { acao: keyof typeof ACOES; id: string; variante?: "primario" | "contorno" | "perigo" }) {
  const { pendente, executar, router } = useExecutar();
  const a = ACOES[acao];
  const Icone = a.icone;
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (a.confirmar && !window.confirm(a.confirmar)) return;
        executar(() => a.fn(id), acao === "excluir" ? () => router.push("/nr1") : undefined);
      }}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium disabled:opacity-50",
        variante === "primario" ? "bg-primary text-primary-foreground hover:bg-primary/90" : variante === "perigo" ? "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10" : "border border-border bg-card hover:bg-muted",
      )}
    >
      {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icone className="size-4" aria-hidden />}
      {a.rotulo}
    </button>
  );
}

/** Revisão das severidades de referência da matriz indicativa. */
export function RevisarMatriz({ id, fatores }: { id: string; fatores: { id: string; nome: string; severidade: number }[] }) {
  const [sev, setSev] = useState<Record<string, number>>(Object.fromEntries(fatores.map((f) => [f.id, f.severidade])));
  const { pendente, executar } = useExecutar();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => revisarMatriz(id, sev));
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {fatores.map((f) => (
          <label key={f.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{f.nome}</span>
            <select aria-label={`Severidade de ${f.nome}`} value={sev[f.id]} onChange={(e) => setSev({ ...sev, [f.id]: Number(e.target.value) })} className={cn(campo, "h-9")}>
              {[1, 2, 3].map((s) => (
                <option key={s} value={s}>
                  {SEVERIDADE[s as 1 | 2 | 3]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div>
        <button type="submit" disabled={pendente} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Registrar revisão da matriz
        </button>
      </div>
    </form>
  );
}

export function NovoRisco({ cicloId, fatores }: { cicloId: string; fatores: { id: string; nome: string }[] }) {
  const [d, setD] = useState({ dimensaoId: "", titulo: "", descricao: "", prioridade: "media" as "alta" | "media" | "baixa" });
  const { pendente, executar } = useExecutar();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => registrarRiscoNr1({ cicloId, ...d, dimensaoId: d.dimensaoId || null }), () => setD({ dimensaoId: "", titulo: "", descricao: "", prioridade: "media" }));
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Fator
        <select value={d.dimensaoId} onChange={(e) => setD({ ...d, dimensaoId: e.target.value })} className={cn(campo, "h-10 font-normal")}>
          <option value="">Geral (sem fator específico)</option>
          {fatores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Prioridade
        <select value={d.prioridade} onChange={(e) => setD({ ...d, prioridade: e.target.value as "alta" })} className={cn(campo, "h-10 font-normal")}>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
        Fator priorizado (o que será tratado)
        <input name="tituloRisco" value={d.titulo} maxLength={200} onChange={(e) => setD({ ...d, titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
        Contexto (opcional)
        <textarea rows={2} maxLength={2000} value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} className={cn(campo, "py-2 font-normal")} />
      </label>
      <div>
        <button type="submit" disabled={pendente || d.titulo.trim().length < 3} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40">
          Registrar fator priorizado
        </button>
      </div>
    </form>
  );
}

export function StatusRisco({ id, status }: { id: string; status: string }) {
  const { pendente, executar } = useExecutar();
  return (
    <select
      aria-label="Status do fator priorizado"
      disabled={pendente}
      value={status}
      onChange={(e) => executar(() => alterarStatusRiscoNr1(id, e.target.value))}
      className={cn(campo, "h-8 text-xs")}
    >
      <option value="identificado">Identificado</option>
      <option value="em_tratamento">Em tratamento</option>
      <option value="monitorado">Monitorado</option>
      <option value="encerrado">Encerrado</option>
    </select>
  );
}

export function NovaAcao({ riscoId }: { riscoId: string }) {
  const [d, setD] = useState({ titulo: "", responsavelNome: "", prazo: "" });
  const { pendente, executar } = useExecutar();
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_12rem_10rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => adicionarAcaoNr1({ riscoId, ...d }), () => setD({ titulo: "", responsavelNome: "", prazo: "" }));
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Ação
        <input value={d.titulo} maxLength={300} onChange={(e) => setD({ ...d, titulo: e.target.value })} className={cn(campo, "h-9 font-normal")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Responsável
        <input value={d.responsavelNome} maxLength={120} onChange={(e) => setD({ ...d, responsavelNome: e.target.value })} className={cn(campo, "h-9 font-normal")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Prazo
        <input type="date" value={d.prazo} onChange={(e) => setD({ ...d, prazo: e.target.value })} className={cn(campo, "h-9 font-normal")} />
      </label>
      <button type="submit" disabled={pendente || d.titulo.trim().length < 3 || d.responsavelNome.trim().length < 2} className="h-9 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-40">
        Incluir ação
      </button>
    </form>
  );
}

export function AtualizarAcao({ id, status, evidencia, rotulo }: { id: string; status: string; evidencia: string | null; rotulo: string }) {
  const [st, setSt] = useState(status);
  const [ev, setEv] = useState(evidencia ?? "");
  const { pendente, executar } = useExecutar();
  return (
    <form
      aria-label={`Atualizar ${rotulo}`}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar(() => atualizarAcaoNr1(id, st, ev));
      }}
    >
      <select aria-label="Status da ação" value={st} onChange={(e) => setSt(e.target.value)} className={cn(campo, "h-9")}>
        <option value="pendente">Pendente</option>
        <option value="em_andamento">Em andamento</option>
        <option value="concluida">Concluída</option>
        <option value="cancelada">Cancelada</option>
      </select>
      <input aria-label="Evidência de acompanhamento" value={ev} maxLength={2000} placeholder="Evidência de acompanhamento" onChange={(e) => setEv(e.target.value)} className={cn(campo, "h-9 min-w-48 flex-1")} />
      <button type="submit" disabled={pendente || (st === status && ev === (evidencia ?? ""))} className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
        Salvar
      </button>
    </form>
  );
}

type ItemPrevia = { incluir: boolean; dimensaoId: string; titulo: string; prioridade: "alta" | "media" | "baixa"; acao: string; responsavel: string; prazo: string };

/** Prévia EDITÁVEL das sugestões da IA: nada entra no plano sem revisão e confirmação. */
export function PreviaSugestoes({ id, sugestoes, fatores }: { id: string; sugestoes: SugestoesNr1; fatores: { id: string; nome: string }[] }) {
  const achar = (nome: string) => fatores.find((f) => f.nome.toLowerCase() === nome.toLowerCase() || nome.toLowerCase().includes(f.nome.toLowerCase().split(" ")[0]))?.id ?? "";
  const [itens, setItens] = useState<ItemPrevia[]>(
    sugestoes.plano_acao.map((p) => ({ incluir: false, dimensaoId: achar(p.fator), titulo: p.fator, prioridade: "media", acao: p.acao, responsavel: p.responsavel_sugerido, prazo: "" })),
  );
  const { pendente, executar } = useExecutar();
  const set = (i: number, p: Partial<ItemPrevia>) => setItens((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const escolhidos = itens.filter((x) => x.incluir).map((x) => ({ dimensaoId: x.dimensaoId || null, titulo: x.titulo, prioridade: x.prioridade, acoes: [{ titulo: x.acao, responsavelNome: x.responsavel, prazo: x.prazo }] }));
        if (!escolhidos.length) {
          toast.error("Marque ao menos uma sugestão revisada para incluir no plano.");
          return;
        }
        executar(() => aprovarSugestoesNr1(id, JSON.stringify(escolhidos)));
      }}
    >
      <p className="text-xs text-muted-foreground">Edite, marque e confirme. Ações entram no plano com origem “IA” e o registro de quem revisou.</p>
      {itens.map((x, i) => (
        <fieldset key={i} className={cn("grid gap-2 rounded-md border p-3 sm:grid-cols-2", x.incluir ? "border-primary" : "border-border")}>
          <legend className="sr-only">Sugestão {i + 1}</legend>
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" checked={x.incluir} onChange={(e) => set(i, { incluir: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Incluir no plano (revisado)
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Fator
            <select value={x.dimensaoId} onChange={(e) => set(i, { dimensaoId: e.target.value })} className={cn(campo, "h-9 font-normal")}>
              <option value="">Geral</option>
              {fatores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Prioridade
            <select value={x.prioridade} onChange={(e) => set(i, { prioridade: e.target.value as "alta" })} className={cn(campo, "h-9 font-normal")}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            Fator priorizado
            <input value={x.titulo} maxLength={200} onChange={(e) => set(i, { titulo: e.target.value })} className={cn(campo, "h-9 font-normal")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            Ação
            <input value={x.acao} maxLength={300} onChange={(e) => set(i, { acao: e.target.value })} className={cn(campo, "h-9 font-normal")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Responsável
            <input value={x.responsavel} maxLength={120} onChange={(e) => set(i, { responsavel: e.target.value })} className={cn(campo, "h-9 font-normal")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Prazo
            <input type="date" value={x.prazo} onChange={(e) => set(i, { prazo: e.target.value })} className={cn(campo, "h-9 font-normal")} />
          </label>
        </fieldset>
      ))}
      <div>
        <button type="submit" disabled={pendente} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Confirmar e incluir no plano
        </button>
      </div>
    </form>
  );
}
