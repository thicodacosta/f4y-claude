"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { salvarPdi } from "@/lib/pdi/actions";
import { FOCOS, nomeFoco, PRIORIDADE, type FocoChave, type SugestaoFoco } from "@/lib/pdi/focos";
import { formatarBRL, RESPONSAVEL_ACAO, TIPO_ACAO, type ResponsavelAcao, type TipoAcao } from "@/lib/pdi/calculo";
import { cn } from "@/lib/utils";
import { acaoVazia, focoVazio, type AcaoForm, type FocoForm, type PdiForm } from "@/lib/pdi/form";

type Pessoa = { id: string; nome: string; cargo: string | null; departamento: string | null };

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-semibold";
const ETAPAS = ["Colaborador e período", "Focos", "Objetivos", "Ações", "Revisão"] as const;
/** "1.234,56" / "1234.56" / "R$ 50" → número; vazio → null; inválido → NaN. */
function numeroBRL(v: string) {
  const t = v.replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function validar(etapa: number, d: PdiForm): string | null {
  if (etapa >= 1) {
    if (!d.colaboradorId) return "Selecione o colaborador.";
    if (d.titulo.trim().length < 3) return "Informe o título do plano.";
    if (!d.inicio || !d.fim) return "Informe o início e o término previsto.";
    if (d.fim < d.inicio) return "O término previsto deve ser igual ou posterior ao início.";
  }
  if (etapa >= 2) {
    if (!d.focos.length) return "Escolha ao menos um foco de desenvolvimento.";
    const semNome = d.focos.find((f) => f.chave === "outro" && f.nomePersonalizado.trim().length < 2);
    if (semNome) return "Dê um nome ao foco “Outro”.";
  }
  if (etapa >= 4) {
    for (const f of d.focos)
      for (const a of f.acoes) {
        const n = `em ${nomeFoco(f.chave, f.nomePersonalizado)}`;
        if (a.descricao.trim().length < 3) return `Descreva cada ação ${n}.`;
        if (!a.tipo) return `Escolha o tipo da ação “${a.descricao}”.`;
        if (!a.responsavel) return `Escolha o responsável pela ação “${a.descricao}”.`;
        if (!a.prazo) return `Informe o prazo da ação “${a.descricao}”.`;
        if (a.inicio && a.prazo < a.inicio) return `O prazo da ação “${a.descricao}” é anterior ao início.`;
        if (Number.isNaN(numeroBRL(a.investimento))) return `Investimento inválido na ação “${a.descricao}”.`;
      }
  }
  return null;
}

export function AssistentePdi({ pessoas, inicial, sugestoes, fixarPessoa }: { pessoas: Pessoa[]; inicial: PdiForm; sugestoes?: SugestaoFoco[]; fixarPessoa?: boolean }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(1);
  const [d, setD] = useState<PdiForm>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const edicao = !!inicial.id;
  const pessoa = pessoas.find((p) => p.id === d.colaboradorId);

  const set = (p: Partial<PdiForm>) => setD((x) => ({ ...x, ...p }));
  const setFoco = (k: string, p: Partial<FocoForm>) => setD((x) => ({ ...x, focos: x.focos.map((f) => (f.chaveLocal === k ? { ...f, ...p } : f)) }));
  const setAcao = (fk: string, ak: string, p: Partial<AcaoForm>) =>
    setD((x) => ({ ...x, focos: x.focos.map((f) => (f.chaveLocal === fk ? { ...f, acoes: f.acoes.map((a) => (a.chaveLocal === ak ? { ...a, ...p } : a)) } : f)) }));
  const alternarFoco = (chave: FocoChave) =>
    setD((x) => (x.focos.some((f) => f.chave === chave) ? { ...x, focos: x.focos.filter((f) => f.chave !== chave) } : { ...x, focos: [...x.focos, focoVazio(chave)] }));

  function ir(para: number) {
    if (para > etapa) {
      const e = validar(para - 1, d);
      if (e) {
        setErro(e);
        return;
      }
    }
    setErro(null);
    setEtapa(para);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmar() {
    const e = validar(4, d);
    if (e) {
      setErro(e);
      return;
    }
    const payload = {
      ...d,
      focos: d.focos.map((f) => ({
        id: f.id,
        chave: f.chave,
        nomePersonalizado: f.nomePersonalizado,
        descricao: f.descricao,
        importancia: f.importancia,
        objetivo: f.objetivo,
        acoes: f.acoes.map((a) => ({ id: a.id, descricao: a.descricao, tipo: a.tipo, responsavel: a.responsavel, inicio: a.inicio || null, prazo: a.prazo, investimento: numeroBRL(a.investimento), impacto: a.impacto, mentor: a.mentor })),
      })),
    };
    iniciar(async () => {
      const r = await salvarPdi(JSON.stringify(payload));
      if (r.erro) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(r.ok ?? "PDI salvo.");
      router.push(`/pdi/${r.id}`);
    });
  }

  const totalInvest = d.focos.flatMap((f) => f.acoes).reduce((s, a) => s + (numeroBRL(a.investimento) || 0), 0);
  const focosSemAcao = d.focos.filter((f) => !f.acoes.length);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas">
        {ETAPAS.map((t, i) => (
          <li key={t}>
            <button
              type="button"
              aria-current={etapa === i + 1 ? "step" : undefined}
              onClick={() => ir(i + 1)}
              className={cn("inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 font-medium", etapa === i + 1 && "border-primary bg-primary text-primary-foreground", etapa > i + 1 && "text-teal-strong")}
            >
              <span className="tabular-nums">{etapa > i + 1 ? <Check className="size-4" aria-hidden /> : i + 1}</span> {t}
            </button>
          </li>
        ))}
      </ol>

      {etapa === 1 && (
        <section className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-surface lg:grid-cols-2">
          <label className={cn(rotulo, "lg:col-span-2")}>
            Colaborador
            <select value={d.colaboradorId} disabled={fixarPessoa} onChange={(e) => set({ colaboradorId: e.target.value })} className={cn(campo, "h-10 font-normal")} required>
              <option value="">Selecione…</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.cargo ? ` · ${p.cargo}` : ""}
                  {p.departamento ? ` · ${p.departamento}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={cn(rotulo, "lg:col-span-2")}>
            Título do plano
            <input value={d.titulo} maxLength={120} onChange={(e) => set({ titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: Desenvolvimento 2026 · liderança de projetos" />
          </label>
          <label className={cn(rotulo, "lg:col-span-2")}>
            Descrição (opcional)
            <textarea rows={3} maxLength={2000} value={d.descricao} onChange={(e) => set({ descricao: e.target.value })} className={cn(campo, "py-2 font-normal")} />
          </label>
          <label className={rotulo}>
            Início
            <input type="date" value={d.inicio} onChange={(e) => set({ inicio: e.target.value })} className={cn(campo, "h-10 font-normal")} />
          </label>
          <label className={rotulo}>
            Término previsto
            <input type="date" value={d.fim} min={d.inicio} onChange={(e) => set({ fim: e.target.value })} className={cn(campo, "h-10 font-normal")} />
          </label>
        </section>
      )}

      {etapa === 2 && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-surface">
          {sugestoes && sugestoes.length > 0 && (
            <div className="rounded-md border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-4 text-teal-strong" aria-hidden /> Sugestões a partir do feedback 1:1 (escala 1–5)
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 text-muted-foreground">
                {sugestoes.map((s) => (
                  <li key={s.chave}>
                    <strong className="text-foreground">{nomeFoco(s.chave)}</strong> · {PRIORIDADE[s.prioridade].nome.toLowerCase()} · {s.criterios.map((c) => `${c.nome} (nota ${c.nota})`).join(", ")}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">As sugestões organizam o plano; não são um rótulo sobre a pessoa. Ajuste livremente.</p>
            </div>
          )}
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">Focos de desenvolvimento (escolha um ou mais)</legend>
            <div className="flex flex-wrap gap-2">
              {FOCOS.filter((f) => f.chave !== "outro").map((f) => {
                const ativo = d.focos.some((x) => x.chave === f.chave);
                return (
                  <label key={f.chave} className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", ativo && "border-primary bg-primary text-primary-foreground hover:bg-primary")}>
                    <input type="checkbox" className="sr-only" checked={ativo} onChange={() => alternarFoco(f.chave)} />
                    {ativo && <Check className="size-3.5" aria-hidden />}
                    {f.nome}
                  </label>
                );
              })}
              <button type="button" onClick={() => set({ focos: [...d.focos, focoVazio("outro")] })} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-input px-3.5 text-sm font-medium hover:bg-muted">
                <Plus className="size-3.5" aria-hidden /> Outro
              </button>
            </div>
          </fieldset>
          {d.focos.filter((f) => f.chave === "outro").map((f, i) => (
            <div key={f.chaveLocal} className="flex items-end gap-2">
              <label className={cn(rotulo, "flex-1")}>
                Nome do foco personalizado {i + 1}
                <input value={f.nomePersonalizado} maxLength={80} onChange={(e) => setFoco(f.chaveLocal, { nomePersonalizado: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: Oratória" />
              </label>
              <button type="button" aria-label={`Remover foco personalizado ${i + 1}`} onClick={() => set({ focos: d.focos.filter((x) => x.chaveLocal !== f.chaveLocal) })} className="mb-1 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{d.focos.length} foco(s) selecionado(s).</p>
        </section>
      )}

      {etapa === 3 && (
        <ol className="flex flex-col gap-3">
          {d.focos.map((f, i) => (
            <li key={f.chaveLocal} className="rounded-lg border border-border bg-card p-5 shadow-surface">
              <h3 className="mb-3 font-heading font-bold">
                {i + 1}. {nomeFoco(f.chave, f.nomePersonalizado)}
              </h3>
              <div className="grid gap-3 lg:grid-cols-3">
                <label className={rotulo}>
                  Descrição
                  <textarea rows={3} maxLength={1000} value={f.descricao} onChange={(e) => setFoco(f.chaveLocal, { descricao: e.target.value })} className={cn(campo, "py-2 font-normal")} placeholder="O que este foco envolve para a pessoa" />
                </label>
                <label className={rotulo}>
                  Por que desenvolver
                  <textarea rows={3} maxLength={1000} value={f.importancia} onChange={(e) => setFoco(f.chaveLocal, { importancia: e.target.value })} className={cn(campo, "py-2 font-normal")} placeholder="Impacto no trabalho e na carreira" />
                </label>
                <label className={rotulo}>
                  Objetivo
                  <textarea rows={3} maxLength={1000} value={f.objetivo} onChange={(e) => setFoco(f.chaveLocal, { objetivo: e.target.value })} className={cn(campo, "py-2 font-normal")} placeholder="Comportamento ou resultado esperado no próximo ciclo" />
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}

      {etapa === 4 && (
        <ol className="flex flex-col gap-3">
          {d.focos.map((f, i) => (
            <li key={f.chaveLocal} className="rounded-lg border border-border bg-card p-5 shadow-surface">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-heading font-bold">
                  {i + 1}. {nomeFoco(f.chave, f.nomePersonalizado)}
                </h3>
                <span className="text-xs text-muted-foreground">{f.acoes.length} ação(ões)</span>
              </div>
              <ul className="flex flex-col gap-3">
                {f.acoes.map((a, j) => (
                  <li key={a.chaveLocal} className="rounded-md border border-border bg-muted/30 p-4" aria-label={`Ação ${j + 1} de ${nomeFoco(f.chave, f.nomePersonalizado)}`}>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className={cn(rotulo, "md:col-span-2 xl:col-span-4")}>
                        Ação
                        <input value={a.descricao} maxLength={300} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { descricao: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: Curso de negociação avançada" />
                      </label>
                      <label className={rotulo}>
                        Tipo
                        <select value={a.tipo} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { tipo: e.target.value as TipoAcao })} className={cn(campo, "h-10 font-normal")}>
                          <option value="">Selecione…</option>
                          {Object.entries(TIPO_ACAO).map(([v, r]) => (
                            <option key={v} value={v}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={rotulo}>
                        Responsável
                        <select value={a.responsavel} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { responsavel: e.target.value as ResponsavelAcao })} className={cn(campo, "h-10 font-normal")}>
                          <option value="">Selecione…</option>
                          {Object.entries(RESPONSAVEL_ACAO).map(([v, r]) => (
                            <option key={v} value={v}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={rotulo}>
                        Início
                        <input type="date" value={a.inicio} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { inicio: e.target.value })} className={cn(campo, "h-10 font-normal")} />
                      </label>
                      <label className={rotulo}>
                        Prazo
                        <input type="date" value={a.prazo} min={a.inicio || undefined} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { prazo: e.target.value })} className={cn(campo, "h-10 font-normal")} />
                      </label>
                      <label className={rotulo}>
                        Investimento estimado (R$)
                        <input inputMode="decimal" value={a.investimento} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { investimento: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="0,00" />
                      </label>
                      <label className={rotulo}>
                        Mentor (se houver)
                        <input value={a.mentor} maxLength={120} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { mentor: e.target.value })} className={cn(campo, "h-10 font-normal")} />
                      </label>
                      <label className={cn(rotulo, "md:col-span-2")}>
                        Impacto esperado (estimativa)
                        <input value={a.impacto} maxLength={500} onChange={(e) => setAcao(f.chaveLocal, a.chaveLocal, { impacto: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: reduzir retrabalho em ~20%" />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (a.id && !window.confirm("Remover esta ação? Comentários e progresso dela serão excluídos ao salvar.")) return;
                        setFoco(f.chaveLocal, { acoes: f.acoes.filter((x) => x.chaveLocal !== a.chaveLocal) });
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline"
                    >
                      <Trash2 className="size-4" aria-hidden /> Remover ação
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setFoco(f.chaveLocal, { acoes: [...f.acoes, acaoVazia(d.inicio)] })}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                <Plus className="size-4" aria-hidden /> Adicionar ação
              </button>
            </li>
          ))}
        </ol>
      )}

      {etapa === 5 && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-surface">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Colaborador</dt>
              <dd className="font-medium">{pessoa?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Plano</dt>
              <dd className="font-medium">{d.titulo}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Período</dt>
              <dd className="font-medium tabular-nums">
                {d.inicio.split("-").reverse().join("/")} – {d.fim.split("-").reverse().join("/")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Investimento estimado total</dt>
              <dd className="font-medium tabular-nums">{formatarBRL(totalInvest)}</dd>
            </div>
          </dl>
          <ol className="flex flex-col gap-3">
            {d.focos.map((f) => (
              <li key={f.chaveLocal} className="rounded-md border border-border p-4">
                <p className="font-heading font-bold">{nomeFoco(f.chave, f.nomePersonalizado)}</p>
                {f.objetivo && <p className="mt-1 text-sm text-muted-foreground">Objetivo: {f.objetivo}</p>}
                {f.acoes.length ? (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
                    {f.acoes.map((a) => (
                      <li key={a.chaveLocal}>
                        {a.descricao} · {a.tipo ? TIPO_ACAO[a.tipo] : "—"} · {a.responsavel ? RESPONSAVEL_ACAO[a.responsavel] : "—"} · prazo {a.prazo.split("-").reverse().join("/")}
                        {numeroBRL(a.investimento) ? ` · ${formatarBRL(numeroBRL(a.investimento))}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Sem ações.</p>
                )}
              </li>
            ))}
          </ol>
          {focosSemAcao.length > 0 && (
            <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {focosSemAcao.length} foco(s) sem ações. O plano pode ser salvo, mas só será concluído quando cada foco tiver ações e todas estiverem concluídas.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Impactos são estimativas informadas por quem elabora o plano, não resultados comprovados. O status do PDI é calculado a partir das ações.</p>
        </section>
      )}

      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {etapa > 1 && (
          <button type="button" onClick={() => ir(etapa - 1)} className="h-11 rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-muted">
            Voltar
          </button>
        )}
        {etapa < 5 ? (
          <button type="button" onClick={() => ir(etapa + 1)} className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Continuar
          </button>
        ) : (
          <button type="button" disabled={pendente} onClick={confirmar} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {edicao ? "Salvar alterações" : "Confirmar e criar PDI"}
          </button>
        )}
      </div>
    </div>
  );
}
