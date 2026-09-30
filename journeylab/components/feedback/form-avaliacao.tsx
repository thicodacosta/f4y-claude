"use client";

import { useActionState, useState } from "react";
import { Lightbulb, Loader2, Target } from "lucide-react";
import { salvarAvaliacao } from "@/lib/feedback/avaliacoes-actions";
import {
  calcularMedias,
  CRITERIOS_CULTURA,
  CRITERIOS_PERFORMANCE,
  criteriosMaisBaixos,
  ESCALA,
  focosPdi,
  mediaDimensao,
  PERIODICIDADE,
  SEMAFORO,
  umaCasa,
  type Criterio,
  type Notas,
} from "@/lib/feedback/avaliacao";
import { Mensagem } from "@/components/auth/formularios";
import { Campo, Selecao } from "@/components/admin/campos";
import { Selo } from "@/components/app/lista";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Inicial = {
  id?: string;
  colaboradorId?: string;
  colaboradorNome?: string;
  data: string;
  hoje: string;
  periodicidade: string;
  observacoes?: string;
  notas?: Notas;
};

function Dimensao({ titulo, criterios, notas, alterar }: { titulo: string; criterios: Criterio[]; notas: Notas; alterar: (campo: string, v: number) => void }) {
  const m = mediaDimensao(criterios, notas);
  const preenchidos = criterios.filter((c) => notas[c.campo]).length;
  return (
    <section aria-labelledby={`dim-${titulo}`} className="flex flex-col rounded-lg border border-border bg-card shadow-surface">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h3 id={`dim-${titulo}`} className="font-heading text-base font-bold">
          {titulo}
        </h3>
        <span className="text-sm tabular-nums text-muted-foreground">{m !== null ? <strong className="text-foreground">Média {umaCasa(m)}</strong> : `${preenchidos}/8 notas`}</span>
      </header>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {criterios.map((c) => (
          <li key={c.campo} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.nome}</p>
              <p className="text-xs text-muted-foreground">{c.descricao}</p>
            </div>
            <fieldset className="flex shrink-0 gap-1.5">
              <legend className="sr-only">Nota para {c.nome}</legend>
              {[1, 2, 3, 4, 5].map((v) => (
                <label
                  key={v}
                  title={ESCALA[v]}
                  className={cn(
                    "flex size-10 cursor-pointer items-center justify-center rounded-md border border-border text-sm font-semibold tabular-nums transition-colors hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    notas[c.campo] === v && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  <input
                    type="radio"
                    name={`n_${c.campo}`}
                    value={v}
                    checked={notas[c.campo] === v}
                    onChange={() => alterar(c.campo, v)}
                    required
                    className="sr-only"
                    aria-label={`${v} — ${ESCALA[v]}`}
                  />
                  {v}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Formulário de feedback 1:1: 16 notas obrigatórias com prévia de médias/semáforo pela mesma regra do servidor. */
export function FormAvaliacao({ inicial, pessoas, pdiDisponivel }: { inicial: Inicial; pessoas?: { id: string; nome: string; cargo: string | null }[]; pdiDisponivel: boolean }) {
  const [estado, acao, pendente] = useActionState(salvarAvaliacao, {});
  const [notas, setNotas] = useState<Notas>(inicial.notas ?? {});
  const alterar = (campo: string, v: number) => setNotas((n) => ({ ...n, [campo]: v }));
  const calc = calcularMedias(notas);
  const baixos = criteriosMaisBaixos(notas);
  const focos = focosPdi(notas);

  return (
    <form action={acao} className="grid gap-4 xl:grid-cols-[1fr_minmax(0,340px)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-surface md:grid-cols-3">
          {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
          {pessoas ? (
            <Selecao
              nome="colaboradorId"
              rotulo="Colaborador"
              required
              defaultValue={inicial.colaboradorId ?? ""}
              opcoes={[{ valor: "", rotulo: "Selecione…" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.cargo ? `${p.nome} — ${p.cargo}` : p.nome }))]}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground/85">Colaborador</span>
              <span className="flex h-10 items-center text-sm font-medium">{inicial.colaboradorNome}</span>
            </div>
          )}
          <Campo nome="data" rotulo="Data do feedback" type="date" required defaultValue={inicial.data} max={inicial.hoje} />
          <Selecao
            nome="periodicidade"
            rotulo="Periodicidade"
            defaultValue={inicial.periodicidade}
            ajuda="Define a próxima data recomendada."
            opcoes={Object.entries(PERIODICIDADE).map(([valor, p]) => ({ valor, rotulo: p.nome }))}
          />
        </section>

        <p className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Escala:</strong> 1 = {ESCALA[1].toLowerCase()} · 2 = {ESCALA[2].toLowerCase()} · 3 = {ESCALA[3].toLowerCase()} · 4 = {ESCALA[4].toLowerCase()} · 5 = {ESCALA[5].toLowerCase()}.
        </p>

        <Dimensao titulo="Performance" criterios={CRITERIOS_PERFORMANCE} notas={notas} alterar={alterar} />
        <Dimensao titulo="Cultura" criterios={CRITERIOS_CULTURA} notas={notas} alterar={alterar} />

        <section className="rounded-lg border border-border bg-card p-5 shadow-surface">
          <label htmlFor="observacoes" className="text-[13px] font-semibold text-foreground/85">
            Observações
          </label>
          <textarea
            id="observacoes"
            name="observacoes"
            rows={5}
            maxLength={5000}
            defaultValue={inicial.observacoes ?? ""}
            placeholder="Pontos conversados, exemplos concretos e combinados."
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </section>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <section aria-live="polite" aria-labelledby="resumo" className="rounded-lg border border-border bg-card p-5 shadow-surface">
          <h3 id="resumo" className="font-heading text-base font-bold">
            Resultado
          </h3>
          {calc.completo ? (
            <div className="mt-3 flex flex-col gap-3">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/60 p-2">
                  <dt className="text-[11px] text-muted-foreground">Performance</dt>
                  <dd className="font-heading text-lg font-bold tabular-nums">{umaCasa(calc.performance)}</dd>
                </div>
                <div className="rounded-md bg-muted/60 p-2">
                  <dt className="text-[11px] text-muted-foreground">Cultura</dt>
                  <dd className="font-heading text-lg font-bold tabular-nums">{umaCasa(calc.cultura)}</dd>
                </div>
                <div className="rounded-md bg-muted/60 p-2">
                  <dt className="text-[11px] text-muted-foreground">Geral</dt>
                  <dd className="font-heading text-lg font-bold tabular-nums">{umaCasa(calc.geral)}</dd>
                </div>
              </dl>
              <Selo tom={SEMAFORO[calc.semaforo].tom}>{SEMAFORO[calc.semaforo].nome}</Selo>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              A média final aparece quando todas as notas estiverem preenchidas. Faltam <strong className="text-foreground">{calc.faltando}</strong>.
            </p>
          )}
        </section>

        {baixos.length > 0 && (
          <section aria-labelledby="perguntas" className="rounded-lg border border-border bg-card p-5 shadow-surface">
            <h3 id="perguntas" className="flex items-center gap-2 font-heading text-base font-bold">
              <Lightbulb className="size-4 text-teal-strong" aria-hidden /> Perguntas para a conversa
            </h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {baixos.map((c) => (
                <li key={c.campo}>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {c.nome} · nota {notas[c.campo]}
                  </span>
                  <p>{c.pergunta}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {focos.length > 0 && pdiDisponivel && (
          <p className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
            <Target className="mt-0.5 size-4 shrink-0 text-teal-strong" aria-hidden />
            {focos.length} critério(s) com nota até 2. Depois de salvar, você poderá revisar focos de PDI sugeridos.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Mensagem estado={estado} />
          <Button type="submit" size="lg" className="h-11" disabled={pendente}>
            {pendente && <Loader2 className="animate-spin" />}
            {inicial.id ? "Salvar alterações" : "Salvar feedback"}
          </Button>
        </div>
      </aside>
    </form>
  );
}
