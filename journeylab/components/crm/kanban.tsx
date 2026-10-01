"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, GripVertical, MapPin, MessageCircle } from "lucide-react";
import { moverCandidatura } from "@/lib/crm/actions";
import { linkWhatsapp, STATUS_CANDIDATURA } from "@/lib/crm/normalizar";
import { cn } from "@/lib/utils";

type Status = keyof typeof STATUS_CANDIDATURA;
export type CartaoCandidatura = {
  id: string;
  status: Status;
  candidatoId: string;
  nome: string;
  vaga: string;
  local: string | null;
  telefone: string | null;
  origemCarreiras: boolean;
  atualizado: string;
};

/** Ordem do funil; "Não seguiu" e "Desistiu" ficam ao final. */
export const COLUNAS_CRM: Status[] = ["inscrito", "em_avaliacao", "entrevista", "aprovado", "contratado", "reprovado", "desistiu"];

/**
 * Kanban de candidaturas por etapa. Arrastar (ou escolher a etapa no cartão, para
 * teclado e leitores de tela) chama o servidor, que confere permissão e registra
 * a mudança no histórico do candidato. Falhas desfazem a movimentação otimista.
 */
export function KanbanCandidaturas({ cartoes, podeMover, mostrarVaga }: { cartoes: CartaoCandidatura[]; podeMover: boolean; mostrarVaga: boolean }) {
  const router = useRouter();
  const [local, setLocal] = useState(cartoes);
  const [origem, setOrigem] = useState(cartoes);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Status | null>(null);
  const [, iniciar] = useTransition();
  // Dados novos do servidor substituem o estado otimista.
  if (origem !== cartoes) {
    setOrigem(cartoes);
    setLocal(cartoes);
  }

  function mover(id: string, status: Status) {
    const c = local.find((x) => x.id === id);
    if (!c || c.status === status) return;
    const anterior = local;
    setLocal((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
    iniciar(async () => {
      const r = await moverCandidatura(id, status);
      if (r.erro) {
        setLocal(anterior);
        toast.error(r.erro);
        return;
      }
      toast.success(`${c.nome}: ${r.ok}`);
      router.refresh();
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3">
        {COLUNAS_CRM.map((col) => {
          const lista = local.filter((c) => c.status === col);
          return (
            <section
              key={col}
              aria-label={`${STATUS_CANDIDATURA[col].nome} (${lista.length})`}
              data-coluna={col}
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
              className={cn("flex min-h-48 flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 transition-colors", sobre === col && "border-teal bg-teal-soft")}
            >
              <header className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{STATUS_CANDIDATURA[col].nome}</h3>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{lista.length}</span>
              </header>
              {lista.map((c) => {
                const wa = linkWhatsapp(c.telefone);
                return (
                  <article
                    key={c.id}
                    data-candidatura={c.id}
                    draggable={podeMover}
                    onDragStart={(e) => {
                      setArrastando(c.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                    className={cn("flex flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-surface", podeMover && "cursor-grab active:cursor-grabbing", arrastando === c.id && "opacity-50")}
                  >
                    <div className="flex items-start gap-2">
                      {podeMover && <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <Link href={`/crm/candidatos/${c.candidatoId}`} className="text-sm leading-snug font-semibold hover:text-teal-strong">
                          {c.nome}
                        </Link>
                        {mostrarVaga && <p className="truncate text-xs text-muted-foreground">{c.vaga}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.local && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden /> {c.local}
                        </span>
                      )}
                      {c.origemCarreiras && (
                        <span className="inline-flex items-center gap-1" title="Candidatura pela Página de Carreiras">
                          <Globe className="size-3.5" aria-hidden /> Carreiras
                        </span>
                      )}
                      <span>{c.atualizado}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Abrir conversa no WhatsApp com ${c.nome}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-strong hover:underline">
                          <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
                        </a>
                      ) : (
                        <span />
                      )}
                      {podeMover && (
                        <select
                          aria-label={`Etapa de ${c.nome}`}
                          value={c.status}
                          onChange={(e) => mover(c.id, e.target.value as Status)}
                          className="h-7 max-w-36 rounded-md border border-input bg-background px-1.5 text-xs"
                        >
                          {COLUNAS_CRM.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_CANDIDATURA[s].nome}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </article>
                );
              })}
              {lista.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">{podeMover ? "Arraste candidaturas para cá" : "Nenhuma candidatura"}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
