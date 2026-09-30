import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, CalendarPlus, Minus, Pencil, Sparkles, Target } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje as hojeCivil } from "@/lib/datas";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { escopoCobre } from "@/lib/escopo";
import { PDI_ABERTO } from "@/lib/pdi/regras";
import { cadencia, CRITERIOS_CULTURA, CRITERIOS_PERFORMANCE, ESCALA, ESTADO_CADENCIA, focosPdi, PERIODICIDADE, SEMAFORO, umaCasa, type Criterio, type Notas } from "@/lib/feedback/avaliacao";
import { filtroAvaliacoes, podeEditarAvaliacao, STATUS_REUNIAO } from "@/lib/feedback/regras";
import { criarPdiDoFeedback, excluirAvaliacao } from "@/lib/feedback/avaliacoes-actions";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Feedback 1:1" };

const notasDe = (a: object) => Object.fromEntries([...CRITERIOS_PERFORMANCE, ...CRITERIOS_CULTURA].map((c) => [c.campo, (a as Record<string, number>)[c.campo]])) as Notas;

function Delta({ atual, anterior }: { atual: number; anterior: number | undefined }) {
  if (anterior === undefined) return null;
  const d = atual - anterior;
  if (d === 0) return <Minus className="size-3.5 text-muted-foreground" aria-label="igual ao anterior" />;
  return d > 0 ? (
    <span className="inline-flex items-center text-xs font-semibold text-success"><ArrowUp className="size-3.5" aria-hidden />+{d}<span className="sr-only"> em relação ao anterior</span></span>
  ) : (
    <span className="inline-flex items-center text-xs font-semibold text-destructive"><ArrowDown className="size-3.5" aria-hidden />{d}<span className="sr-only"> em relação ao anterior</span></span>
  );
}

function Dimensao({ titulo, criterios, notas, anteriores, media }: { titulo: string; criterios: Criterio[]; notas: Notas; anteriores: Notas | null; media: string }) {
  return (
    <Cartao aria-label={titulo}>
      <CabecalhoCartao titulo={titulo} acao={<span className="font-heading text-lg font-bold tabular-nums">{media}</span>} />
      <ul className="flex flex-col gap-2.5 px-5 pb-5">
        {criterios.map((c) => {
          const v = notas[c.campo]!;
          return (
            <li key={c.campo} className="grid grid-cols-[1fr_7rem_3.5rem] items-center gap-3 text-sm">
              <span className="min-w-0 truncate" title={c.descricao}>{c.nome}</span>
              <span className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${c.nome}: ${v} de 5 — ${ESCALA[v]}`}>
                <span className={`h-full rounded-full ${v <= 2 ? "bg-destructive" : v === 3 ? "bg-warning" : "bg-teal"}`} style={{ width: `${v * 20}%` }} />
              </span>
              <span className="flex items-center justify-end gap-1 font-semibold tabular-nums">
                {v} <Delta atual={v} anterior={anteriores?.[c.campo]} />
              </span>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

export default async function AvaliacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, escopo, db } = await exigirModulo("feedback");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = await db.avaliacaoFeedback.findFirst({
    where: { AND: [{ id }, filtroAvaliacoes(ctx, escopo)] },
    include: {
      colaborador: { select: { id: true, nome: true, cargo: true, gestorId: true, status: true, dataAdmissao: true, equipe: { select: { nome: true, area: { select: { nome: true } } } } } },
      gestor: { select: { nome: true } },
      reunioes: { orderBy: { dataHora: "asc" }, select: { id: true, dataHora: true, status: true } },
    },
  });
  if (!a) notFound();
  const [anterior, maisRecente] = await Promise.all([
    db.avaliacaoFeedback.findFirst({
      where: { colaboradorId: a.colaboradorId, OR: [{ data: { lt: a.data } }, { data: a.data, criadoEm: { lt: a.criadoEm } }] },
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    }),
    db.avaliacaoFeedback.findFirst({ where: { colaboradorId: a.colaboradorId }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], select: { id: true } }),
  ]);
  const notas = notasDe(a);
  const anteriores = anterior ? notasDe(anterior) : null;
  const edita = podeEditarAvaliacao(ctx, pode(ctx, "feedback", "editar"), a.colaborador);
  const agenda = !!pode(ctx, "feedback", "criar") && !ctx.suporte;
  const cad = maisRecente?.id === a.id ? cadencia({ data: a.data, periodicidade: a.periodicidade }, a.colaborador.dataAdmissao, hojeCivil()) : null;

  // PDI: só com o módulo contratado e permissão no PDI da pessoa.
  const focos = focosPdi(notas);
  const pdiAberto = ctx.modulos.has("pdi") ? await db.pdi.findFirst({ where: { colaboradorId: a.colaboradorId, status: { in: [...PDI_ABERTO] } }, select: { id: true, titulo: true } }) : null;
  const podePdi = focos.length > 0 && ctx.modulos.has("pdi") && !ctx.suporte && a.colaborador.status === "ativo" && escopoCobre(ctx, pode(ctx, "pdi", pdiAberto ? "editar" : "criar"), a.colaborador);

  return (
    <>
      {sp.salvo && <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">Feedback salvo. Médias e semáforo calculados.</p>}
      <div className="flex flex-col gap-3">
        <Link href="/feedback" className="text-sm text-muted-foreground hover:text-foreground">← Feedback 1:1</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{a.colaborador.nome}</h2>
          <Selo tom={SEMAFORO[a.semaforo].tom}>{SEMAFORO[a.semaforo].nome}</Selo>
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Cargo · departamento</dt><dd className="font-medium">{[a.colaborador.cargo, a.colaborador.equipe?.area?.nome ?? a.colaborador.equipe?.nome].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Gestor</dt><dd className="font-medium">{a.gestor?.nome ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Data · periodicidade</dt><dd className="font-medium">{formatarData(a.data)} · {PERIODICIDADE[a.periodicidade].nome}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Registrado por</dt><dd className="font-medium">{a.autorNome} · {formatarDataHora(a.criadoEm.toISOString())}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {edita && (
            <Link href={`/feedback/avaliacoes/${a.id}/editar`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
              <Pencil className="size-4" aria-hidden /> Editar
            </Link>
          )}
          {agenda && a.colaborador.status === "ativo" && (
            <Link href={`/feedback/agendar?colaborador=${a.colaborador.id}&avaliacao=${a.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <CalendarPlus className="size-4" aria-hidden /> Agendar próximo 1:1
            </Link>
          )}
        </div>
      </div>

      <section aria-label="Médias" className="grid grid-cols-3 gap-3">
        {[
          ["Performance", a.mediaPerformance, anterior?.mediaPerformance],
          ["Cultura", a.mediaCultura, anterior?.mediaCultura],
          ["Geral", a.mediaGeral, anterior?.mediaGeral],
        ].map(([rotulo, v, ant]) => (
          <div key={String(rotulo)} className="rounded-lg border border-border bg-card p-4 shadow-surface">
            <p className="text-[13px] font-medium text-muted-foreground">{String(rotulo)}</p>
            <p className="font-heading text-[28px] font-bold tabular-nums">{umaCasa(v!)}</p>
            {ant !== undefined && ant !== null && <p className="text-xs text-muted-foreground">Anterior: {umaCasa(ant)}</p>}
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Dimensao titulo="Performance" criterios={CRITERIOS_PERFORMANCE} notas={notas} anteriores={anteriores} media={umaCasa(a.mediaPerformance)} />
            <Dimensao titulo="Cultura" criterios={CRITERIOS_CULTURA} notas={notas} anteriores={anteriores} media={umaCasa(a.mediaCultura)} />
          </div>
          {anterior && (
            <p className="text-sm text-muted-foreground">
              Setas comparam com o <Link href={`/feedback/avaliacoes/${anterior.id}`} className="font-medium text-teal-strong hover:underline">feedback anterior, de {formatarData(anterior.data)}</Link> ({SEMAFORO[anterior.semaforo].nome.split(" · ")[0].toLowerCase()}, geral {umaCasa(anterior.mediaGeral)}).
            </p>
          )}
          <Cartao aria-labelledby="obs" className="p-5">
            <h3 id="obs" className="font-heading text-base font-bold">Observações</h3>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{a.observacoes || <span className="text-muted-foreground">Sem observações.</span>}</p>
          </Cartao>

          {podePdi && (
            <Cartao aria-labelledby="pdi">
              <CabecalhoCartao
                id="pdi"
                titulo="Sugestão de PDI"
                descricao={`${focos.length} critério(s) com nota até 2. Revise os focos — nada é criado sem a sua confirmação.`}
              />
              <div className="px-5 pb-5">
                <details>
                  <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-teal-strong">
                    <Target className="size-4" aria-hidden /> Revisar prévia do PDI
                  </summary>
                  <FormAcao action={criarPdiDoFeedback} textoBotao={pdiAberto ? "Confirmar e incluir no PDI aberto" : "Confirmar e criar PDI (rascunho)"} className="mt-3">
                    <input type="hidden" name="avaliacaoId" value={a.id} />
                    {pdiAberto ? (
                      <p className="text-sm text-muted-foreground">
                        Os objetivos serão incluídos no PDI aberto <strong className="text-foreground">{pdiAberto.titulo}</strong>.
                        <input type="hidden" name="titulo" value={pdiAberto.titulo} />
                      </p>
                    ) : (
                      <Campo nome="titulo" rotulo="Título do plano" defaultValue={`Desenvolvimento — ${a.colaborador.nome.split(" ")[0]}`} required />
                    )}
                    <fieldset className="flex flex-col gap-2">
                      <legend className="mb-1 text-[13px] font-semibold text-foreground/85">Objetivos (edite ou apague os que não fizerem sentido)</legend>
                      {focos.map((c, i) => (
                        <Campo key={c.campo} nome="objetivo" idCampo={`obj-${i}`} rotulo={`${c.nome} · nota ${notas[c.campo]}`} defaultValue={c.focoPdi} />
                      ))}
                      <Campo nome="objetivo" idCampo="obj-extra" rotulo="Outro objetivo (opcional)" />
                    </fieldset>
                  </FormAcao>
                </details>
              </div>
            </Cartao>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {cad && (
            <Cartao className="p-5">
              <p className="text-[13px] font-medium text-muted-foreground">Próximo feedback recomendado</p>
              {cad.proxima ? (
                <>
                  <p className="font-heading text-xl font-bold">{formatarData(cad.proxima)}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm">
                    <Selo tom={ESTADO_CADENCIA[cad.estado].tom}>{ESTADO_CADENCIA[cad.estado].nome}</Selo>
                    <span className="text-muted-foreground">{cad.dias! >= 0 ? `faltam ${cad.dias} dia(s)` : `${-cad.dias!} dia(s) de atraso`}</span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Periodicidade manual: sem data recomendada.</p>
              )}
            </Cartao>
          )}

          {a.reunioes.length > 0 && (
            <Cartao aria-labelledby="reunioes">
              <CabecalhoCartao id="reunioes" titulo="1:1 agendados a partir deste feedback" />
              <ul className="flex flex-col gap-1.5 px-5 pb-5 text-sm">
                {a.reunioes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={`/feedback/${r.id}`} className="hover:text-teal-strong">{formatarDataHora(r.dataHora.toISOString())}</Link>
                    <Selo tom={STATUS_REUNIAO[r.status].tom}>{STATUS_REUNIAO[r.status].nome}</Selo>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <Cartao className="p-5">
            <p className="flex items-center gap-2 font-heading text-base font-bold">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden /> Insight com IA
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Indisponível: nenhum serviço de IA está configurado nesta instalação. O feedback funciona normalmente sem ele.
            </p>
            <button type="button" disabled className="mt-3 inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground opacity-60">
              Gerar insight com IA
            </button>
          </Cartao>

          {edita && (
            <Cartao className="p-5">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-destructive">Excluir feedback…</summary>
                <FormAcao action={excluirAvaliacao} textoBotao="Excluir definitivamente" variante="destructive" className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="confirmo" className="mt-0.5 size-4 accent-[var(--destructive)]" />
                    Confirmo a exclusão deste feedback de {formatarData(a.data)}. A ação fica registrada na auditoria.
                  </label>
                </FormAcao>
              </details>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
