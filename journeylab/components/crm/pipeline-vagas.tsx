"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Globe, GripVertical, KanbanSquare, Users } from "lucide-react";
import { alterarPrioridadeVaga, moverVagaPipeline } from "@/lib/crm/pipeline-actions";
import { ETAPAS_PIPELINE, ORDEM_PIPELINE, PRIORIDADES, type EtapaPipeline, type Prioridade } from "@/lib/crm/pipeline";
import { cn } from "@/lib/utils";

export type CartaoVaga = {
  id: string;
  titulo: string;
  etapa: EtapaPipeline;
  prioridade: Prioridade;
  publicada: boolean;
  pausada: boolean;
  equipe: string | null;
  gestor: string | null;
  diasAberta: number;
  prazo: string | null;
  prazoVencido: boolean;
  posicoes: number;
  contratados: number;
  funil: { inscrito: number; avaliacao: number; entrevista: number; aprovado: number };
  destaques: { candidatoId: string; nome: string; etapa: string }[];
};

const TOM_PRIORIDADE = {
  perigo: "bg-destructive/10 text-destructive",
  alerta: "bg-warning/15 text-warning-foreground dark:text-warning",
  info: "bg-teal-soft text-teal-strong",
  neutro: "bg-muted text-muted-foreground",
} as const;

/**
 * Pipeline de Vagas (estilo Trello): cada cartão é uma vaga, nas colunas das
 * etapas do processo seletivo. Arrastar (ou escolher a etapa no cartão — teclado
 * e leitor de tela) chama o servidor; falhas desfazem a movimentação otimista.
 * O cartão mostra o mini-funil de candidatos e leva ao Kanban da vaga no CRM.
 */
export function PipelineVagas({ cartoes, podeMover }: { cartoes: CartaoVaga[]; podeMover: boolean }) {
  const router = useRouter();
  const [local, setLocal] = useState(cartoes);
  const [origem, setOrigem] = useState(cartoes);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EtapaPipeline | null>(null);
  const [, iniciar] = useTransition();
  if (origem !== cartoes) {
    setOrigem(cartoes);
    setLocal(cartoes);
  }

  function mover(id: string, etapa: EtapaPipeline) {
    const c = local.find((x) => x.id === id);
    if (!c || c.etapa === etapa) return;
    if (etapa === "concluida" && !window.confirm(`Concluir “${c.titulo}”? A vaga será encerrada e sairá da Página de Carreiras. Candidaturas e histórico são mantidos.`)) return;
    const anterior = local;
    setLocal((l) => l.map((x) => (x.id === id ? { ...x, etapa } : x)));
    iniciar(async () => {
      const r = await moverVagaPipeline(id, etapa);
      if (r.erro) {
        setLocal(anterior);
        toast.error(r.erro);
        return;
      }
      toast.success(`${c.titulo}: ${r.ok}`);
      router.refresh();
    });
  }

  function prioridade(id: string, p: Prioridade) {
    const anterior = local;
    setLocal((l) => l.map((x) => (x.id === id ? { ...x, prioridade: p } : x)));
    iniciar(async () => {
      const r = await alterarPrioridadeVaga(id, p);
      if (r.erro) {
        setLocal(anterior);
        toast.error(r.erro);
      }
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(16.5rem,1fr)] grid-flow-col gap-3">
        {ORDEM_PIPELINE.map((col) => {
          const lista = local.filter((c) => c.etapa === col).sort((a, b) => PRIORIDADES[a.prioridade].ordem - PRIORIDADES[b.prioridade].ordem || b.diasAberta - a.diasAberta);
          return (
            <section
              key={col}
              aria-label={`${ETAPAS_PIPELINE[col].nome} (${lista.length})`}
              data-etapa={col}
              onDragOver={(e) => {
                if (!podeMover) return;
                e.preventDefault();
                setSobre(col);
              }}
              onDragLeave={() => setSobre((s) => (s === col ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const id = e.dataTransfer.getData("text/plain") || arrastando;
                setArrastando(null);
                if (id) mover(id, col);
              }}
              className={cn("flex min-h-56 flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 transition-colors", sobre === col && "border-teal bg-teal-soft")}
            >
              <header className="flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{ETAPAS_PIPELINE[col].nome}</h3>
                  <p className="text-[11px] leading-snug text-muted-foreground">{ETAPAS_PIPELINE[col].ajuda}</p>
                </div>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{lista.length}</span>
              </header>
              {lista.map((c) => {
                const p = PRIORIDADES[c.prioridade];
                const emProcesso = c.funil.inscrito + c.funil.avaliacao + c.funil.entrevista + c.funil.aprovado;
                return (
                  <article
                    key={c.id}
                    data-vaga={c.id}
                    draggable={podeMover}
                    onDragStart={(e) => {
                      setArrastando(c.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                    className={cn("flex flex-col gap-2.5 rounded-md border border-border bg-card p-3 shadow-surface", podeMover && "cursor-grab active:cursor-grabbing", arrastando === c.id && "opacity-50", c.prazoVencido && col !== "concluida" && "border-l-4 border-l-destructive")}
                  >
                    <div className="flex items-start gap-2">
                      {podeMover && <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <Link href={`/pagina-carreiras/vagas/${c.id}`} className="text-sm leading-snug font-semibold hover:text-teal-strong">
                          {c.titulo}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{[c.equipe, c.gestor && `Gestor: ${c.gestor}`].filter(Boolean).join(" · ") || "Sem equipe/gestor"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium", TOM_PRIORIDADE[p.tom])}>{p.nome}</span>
                      {c.publicada && (
                        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-teal-soft px-2 text-[11px] font-medium text-teal-strong" title="Publicada na Página de Carreiras">
                          <Globe className="size-3" aria-hidden /> Publicada
                        </span>
                      )}
                      {c.pausada && <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">Pausada</span>}
                      <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
                        {c.contratados}/{c.posicoes} {c.posicoes === 1 ? "posição" : "posições"}
                      </span>
                    </div>
                    {/* Mini-funil de candidatos da vaga */}
                    <dl className="grid grid-cols-4 gap-1 text-center" aria-label="Candidatos por etapa">
                      {[
                        ["Inscr.", c.funil.inscrito, "Inscritos"],
                        ["Aval.", c.funil.avaliacao, "Em avaliação"],
                        ["Entr.", c.funil.entrevista, "Em entrevista"],
                        ["Aprov.", c.funil.aprovado, "Aprovados"],
                      ].map(([r, n, nome]) => (
                        <div key={r as string} className="rounded bg-muted/70 py-1" title={nome as string}>
                          <dt className="text-[10px] text-muted-foreground">
                            <span aria-hidden>{r}</span>
                            <span className="sr-only">{nome}</span>
                          </dt>
                          <dd className="text-sm font-semibold tabular-nums">{n}</dd>
                        </div>
                      ))}
                    </dl>
                    {c.destaques.length > 0 && (
                      <ul className="flex flex-col gap-0.5 text-xs">
                        {c.destaques.map((d) => (
                          <li key={d.candidatoId} className="flex items-center justify-between gap-2">
                            <Link href={`/crm/candidatos/${d.candidatoId}`} className="truncate hover:text-teal-strong">
                              {d.nome}
                            </Link>
                            <span className="shrink-0 text-muted-foreground">{d.etapa}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={cn("inline-flex items-center gap-1", c.prazoVencido && col !== "concluida" && "font-semibold text-destructive")}>
                        <CalendarClock className="size-3.5" aria-hidden />
                        {c.prazo ? `${c.prazoVencido && col !== "concluida" ? "Venceu" : "Prazo"} ${c.prazo}` : `${c.diasAberta} d aberta`}
                      </span>
                      <Link href={`/crm?visao=kanban&vaga=${c.id}`} className="inline-flex items-center gap-1 font-medium text-teal-strong hover:underline" aria-label={`Ver ${emProcesso} candidato(s) de ${c.titulo} no Kanban do CRM`}>
                        <Users className="size-3.5" aria-hidden /> {emProcesso} em processo
                      </Link>
                    </div>
                    {podeMover && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <select aria-label={`Etapa de ${c.titulo}`} value={c.etapa} onChange={(e) => mover(c.id, e.target.value as EtapaPipeline)} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs">
                          {ORDEM_PIPELINE.map((s) => (
                            <option key={s} value={s}>
                              {ETAPAS_PIPELINE[s].nome}
                            </option>
                          ))}
                        </select>
                        <select aria-label={`Prioridade de ${c.titulo}`} value={c.prioridade} onChange={(e) => prioridade(c.id, e.target.value as Prioridade)} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs">
                          {Object.entries(PRIORIDADES).map(([v, x]) => (
                            <option key={v} value={v}>
                              {x.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </article>
                );
              })}
              {lista.length === 0 && (
                <p className="flex flex-col items-center gap-1 px-1 py-6 text-center text-xs text-muted-foreground">
                  <KanbanSquare className="size-4" aria-hidden />
                  {podeMover ? "Arraste vagas para cá" : "Nenhuma vaga"}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
