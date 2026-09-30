import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EyeOff, Pencil, Sparkles } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { diasEntre, hoje } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { iaDisponivel, insightsSchema } from "@/lib/ia";
import { AUDIENCIA, filtroPesquisas, STATUS_PESQUISA } from "@/lib/pulse/regras";
import { adesaoDiaria, adesaoPulse, participantes, resultadoPulse, type Resumo } from "@/lib/pulse/consultas";
import { analisarPergunta, mediaGeral, type ResultadoPergunta } from "@/lib/pulse/analise";
import { calcularEnps, deBanco, faixa, umaCasa, NUMERICOS } from "@/lib/pulse/perguntas";
import { urlResposta } from "@/lib/pulse/links";
import { valorPermitido } from "@/lib/validacao";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao, LinkExportar } from "@/components/app/painel";
import { BotaoPesquisa, CopiarLink, SalvarModelo } from "@/components/pulse/acoes";
import { MedidorEnps, ResultadoCartao } from "@/components/pulse/resultado";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pesquisa · Pulse" };

const ABAS = { visao: "Visão geral", resultados: "Resultados por pergunta", enps: "eNPS", departamentos: "Comparativo por departamento", insights: "Insights IA" } as const;

const MOTIVO = {
  aberta: "Pesquisa anônima: os resultados ficam disponíveis após o encerramento.",
  minimo: "Ainda não atingiu o mínimo de respondentes para preservar o anonimato.",
  complemento: "Não pode ser exibido: combinado ao total, permitiria deduzir respostas de um grupo pequeno.",
} as const;

function Bloqueado({ resumo }: { resumo: Resumo | null }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">
      <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      {resumo?.motivo ? MOTIVO[resumo.motivo] : "Sem respostas até o momento."}
      {resumo?.motivo === "minimo" && ` (${resumo.respondentes} de ${resumo.minimo} necessários)`}
    </p>
  );
}

export default async function PesquisaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { ctx, db } = await exigirModulo("pulse");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const gerencia = pode(ctx, "pulse", "criar") === "todos";
  const p = await db.pesquisaPulse.findFirst({ where: { AND: [{ id }, filtroPesquisas(gerencia)] }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
  if (!p) notFound();
  const gestao = gerencia && !ctx.suporte;
  const temNps = p.perguntas.some((q) => q.tipo === "nps");
  const abasVisiveis = (Object.keys(ABAS) as (keyof typeof ABAS)[]).filter((a) => a !== "enps" || temNps);
  const aba = (valorPermitido(sp.tab, ABAS) as keyof typeof ABAS | undefined) ?? "visao";
  const areas = await db.area.findMany({
    where: p.audienciaTipo === "departamentos" ? { id: { in: p.areaIds } } : {},
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  const h = hoje();
  const perguntas = p.perguntas.map((q) => ({ def: deBanco(q), dbId: q.id }));
  const analisar = (linhas: Awaited<ReturnType<typeof resultadoPulse>>) => perguntas.map((q) => analisarPergunta(q.def, q.dbId, linhas.linhas, linhas.comentarios));

  let conteudo: React.ReactNode = null;

  if (p.status === "rascunho") {
    conteudo = (
      <Cartao className="p-5">
        <p className="text-sm text-muted-foreground">Rascunho: revise as perguntas e a audiência e envie quando estiver pronto.</p>
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm">
          {p.perguntas.map((q) => (
            <li key={q.id}>{q.texto}</li>
          ))}
        </ol>
      </Cartao>
    );
  } else if (aba === "visao") {
    const [adesao, diaria, ident] = await Promise.all([adesaoPulse(ctx, p.id), adesaoDiaria(ctx, p.id), p.anonima ? Promise.resolve([]) : participantes(ctx, p.id)]);
    const pct = adesao.publico ? Math.min(100, Math.round((adesao.respondentes / adesao.publico) * 100)) : 0;
    const restantes = p.status === "aberta" && p.encerraEm ? diasEntre(h, p.encerraEm) : null;
    const maxDia = Math.max(1, ...diaria.map((d) => d.n));
    const nomes = ident.length ? await db.colaborador.findMany({ where: { id: { in: ident.map((i) => i.colaborador_id) } }, select: { id: true, nome: true } }) : [];
    conteudo = (
      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao className="p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Participação</p>
          <p className="mt-2 font-heading text-[32px] leading-none font-bold tabular-nums">{pct}%</p>
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
          </span>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {adesao.respondentes} de {adesao.publico} pessoas {p.linkAberto && "(+ respostas pelo link aberto)"}
          </p>
        </Cartao>
        <Cartao className="p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Prazo</p>
          <p className="mt-2 font-heading text-[32px] leading-none font-bold tabular-nums">
            {p.status === "encerrada" ? "Encerrada" : restantes === null ? "Sem data" : restantes < 0 ? "Vencido" : `${restantes} dia(s)`}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {p.dataInicio && `Início ${formatarData(p.dataInicio)}`}
            {p.encerraEm && ` · fim ${formatarData(p.encerraEm)}`}
            {p.encerradaEm && ` · encerrada em ${formatarData(p.encerradaEm)}`}
          </p>
        </Cartao>
        <Cartao className="p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Configuração</p>
          <p className="mt-2 text-sm">
            {p.anonima ? "Anônima" : "Identificada"} · {AUDIENCIA[p.audienciaTipo as keyof typeof AUDIENCIA] ?? p.audienciaTipo}
            {p.linkAberto && " · link aberto"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {p.perguntas.length} pergunta(s) · criada por {p.criadoPor}
          </p>
        </Cartao>
        <Cartao aria-labelledby="evolucao" className="lg:col-span-3">
          <CabecalhoCartao id="evolucao" titulo="Evolução diária de respostas" descricao={p.anonima ? "Contagem por dia de participação (o horário não é guardado nas respostas)." : undefined} />
          <div className="px-5 pb-5">
            {diaria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma resposta ainda.</p>
            ) : (
              <ul className="flex h-40 items-end gap-1.5" aria-label="Respostas por dia">
                {diaria.map((d) => (
                  <li key={String(d.dia)} className="flex min-w-6 flex-1 flex-col items-center gap-1" title={`${formatarData(d.dia)}: ${d.n}`}>
                    <span className="text-[11px] tabular-nums">{d.n}</span>
                    <span className="w-full rounded-t bg-teal" style={{ height: `${Math.max(4, (d.n / maxDia) * 110)}px` }} />
                    <span className="text-[10px] text-muted-foreground">{formatarData(d.dia).slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Cartao>
        {!p.anonima && (
          <Cartao aria-labelledby="quem" className="lg:col-span-3">
            <CabecalhoCartao id="quem" titulo="Quem respondeu" descricao="Pesquisa identificada — informado aos respondentes." />
            <ul className="grid gap-1 px-5 pb-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {ident.length === 0 && <li className="text-muted-foreground">Ninguém ainda.</li>}
              {ident.map((i) => (
                <li key={i.colaborador_id}>
                  {nomes.find((n) => n.id === i.colaborador_id)?.nome ?? "—"} <span className="text-xs text-muted-foreground">· {formatarData(i.respondido_em)}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </div>
    );
  } else if (aba === "resultados") {
    const area = areas.find((a) => a.id === sp.departamento) ?? null;
    const r = await resultadoPulse(ctx, p.id, area?.id ?? null);
    conteudo = (
      <div className="flex flex-col gap-3">
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value="resultados" />
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Recorte
            <select name="departamento" defaultValue={area?.id ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal">
              <option value="">Toda a organização</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            Aplicar
          </button>
          {r.resumo?.liberado && <span className="ml-auto text-sm text-muted-foreground tabular-nums">{r.resumo.respondentes} respondente(s)</span>}
        </form>
        {r.resumo?.liberado ? (
          <ol className="flex flex-col gap-3">
            {analisar(r).map((x, i) => (
              <ResultadoCartao key={i} r={x} n={i + 1} />
            ))}
          </ol>
        ) : (
          <Bloqueado resumo={r.resumo} />
        )}
      </div>
    );
  } else if (aba === "enps") {
    const npsIds = p.perguntas.filter((q) => q.tipo === "nps").map((q) => q.id);
    const enpsDe = (r: Awaited<ReturnType<typeof resultadoPulse>>) => {
      const m = new Map<number, number>();
      for (const l of r.linhas) if (npsIds.includes(l.pergunta_id) && l.valor !== null) m.set(l.valor, (m.get(l.valor) ?? 0) + l.n);
      return calcularEnps(m);
    };
    const org = await resultadoPulse(ctx, p.id, null);
    const porArea = org.resumo?.liberado ? await Promise.all(areas.map(async (a) => ({ a, r: await resultadoPulse(ctx, p.id, a.id) }))) : [];
    const e = org.resumo?.liberado ? enpsDe(org) : null;
    conteudo = !org.resumo?.liberado ? (
      <Bloqueado resumo={org.resumo} />
    ) : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <Cartao className="flex flex-col items-center justify-center p-6">
          {e ? <MedidorEnps enps={e} /> : <p className="text-sm text-muted-foreground">Sem respostas de eNPS.</p>}
          <p className="mt-3 text-center text-xs text-muted-foreground">Excelente ≥ 50 · Bom ≥ 0 · Crítico &lt; 0</p>
        </Cartao>
        <Cartao aria-labelledby="enps-dep">
          <CabecalhoCartao id="enps-dep" titulo="eNPS por departamento" descricao="Recortes abaixo do mínimo de respondentes ficam ocultos." />
          <ul className="flex flex-col gap-2 px-5 pb-5">
            {porArea.map(({ a, r }) => {
              const ea = r.resumo?.liberado ? enpsDe(r) : null;
              return (
                <li key={a.id} className="grid grid-cols-[minmax(0,12rem)_1fr_5.5rem] items-center gap-3 text-sm">
                  <span className="truncate">{a.nome}</span>
                  {ea ? (
                    <>
                      <span className="relative h-2 rounded-full bg-muted" aria-hidden>
                        <span className="absolute top-0 left-1/2 h-2 w-px bg-border" />
                        <span
                          className={cn("absolute top-0 h-2 rounded-full", ea.enps >= 50 ? "bg-success" : ea.enps >= 0 ? "bg-warning" : "bg-destructive")}
                          style={ea.enps >= 0 ? { left: "50%", width: `${ea.enps / 2}%` } : { right: "50%", width: `${-ea.enps / 2}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">
                        <strong>{ea.enps}</strong> <span className="text-xs text-muted-foreground">({ea.total})</span>
                      </span>
                    </>
                  ) : (
                    <span className="col-span-2 text-xs text-muted-foreground">{r.resumo?.motivo === "complemento" ? "Oculto (complemento)" : "Abaixo do mínimo"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Cartao>
      </div>
    );
  } else if (aba === "departamentos") {
    const org = await resultadoPulse(ctx, p.id, null);
    const numericas = perguntas.filter((q) => NUMERICOS.includes(q.def.type));
    const colunas = org.resumo?.liberado ? await Promise.all(areas.map(async (a) => ({ a, r: await resultadoPulse(ctx, p.id, a.id) }))) : [];
    const res = (r: Awaited<ReturnType<typeof resultadoPulse>>) => new Map<string, ResultadoPergunta>(numericas.map((q) => [q.dbId, analisarPergunta(q.def, q.dbId, r.linhas, r.comentarios)]));
    const geral = res(org);
    const porColuna = colunas.map((c) => ({ ...c, mapa: c.r.resumo?.liberado ? res(c.r) : null }));
    const celula = (q: (typeof numericas)[number], r?: ResultadoPergunta) => {
      const m = r ? mediaGeral(r) : null;
      if (m === null) return <td className="border border-border px-2 py-2 text-center text-xs text-muted-foreground">—</td>;
      const f = faixa(q.def);
      const t = f.max > f.min ? Math.max(0, Math.min(1, (m - f.min) / (f.max - f.min))) : 0.5;
      const cor = t >= 0.7 ? "var(--success)" : t >= 0.5 ? "var(--warning)" : "var(--destructive)";
      return (
        <td className="border border-border px-2 py-2 text-center text-sm font-semibold tabular-nums" style={{ background: `color-mix(in oklab, ${cor} ${Math.round(12 + Math.abs(t - 0.6) * 45)}%, transparent)` }}>
          {q.def.type === "nps" && r?.enps ? r.enps.enps : umaCasa(m)}
        </td>
      );
    };
    conteudo = !org.resumo?.liberado ? (
      <Bloqueado resumo={org.resumo} />
    ) : numericas.length === 0 ? (
      <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">Esta pesquisa não tem perguntas numéricas para comparar.</p>
    ) : (
      <Cartao aria-labelledby="heat">
        <CabecalhoCartao id="heat" titulo="Mapa de calor por departamento" descricao="Média por pergunta (NPS: eNPS). Verde = favorável; vermelho = atenção. “—” = recorte oculto pelo anonimato." />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="border border-border px-2 py-2 text-xs font-semibold">
                  Pergunta
                </th>
                <th scope="col" className="border border-border px-2 py-2 text-center text-xs font-semibold">
                  Organização ({org.resumo.respondentes})
                </th>
                {porColuna.map((c) => (
                  <th key={c.a.id} scope="col" className="border border-border px-2 py-2 text-center text-xs font-semibold">
                    {c.a.nome}
                    {c.mapa && <span className="font-normal text-muted-foreground"> ({c.r.resumo!.respondentes})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numericas.map((q) => (
                <tr key={q.dbId}>
                  <th scope="row" className="max-w-72 border border-border px-2 py-2 text-xs font-medium">
                    {q.def.text}
                  </th>
                  {celula(q, geral.get(q.dbId))}
                  {porColuna.map((c) => (
                    <Fragment key={c.a.id}>{celula(q, c.mapa?.get(q.dbId))}</Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    );
  } else if (aba === "insights") {
    const salvo = insightsSchema.safeParse(p.aiInsights);
    const ia = iaDisponivel();
    const liberado = p.status === "encerrada" || !p.anonima;
    conteudo = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <Sparkles className="size-5 text-teal-strong" aria-hidden />
          <p className="flex-1 text-sm text-muted-foreground">
            {ia
              ? "Análise gerada por IA a partir dos resultados agregados (sem comentários livres e sem identificação). Revise antes de compartilhar."
              : "Insights com IA indisponíveis: a integração não está configurada neste ambiente (ANTHROPIC_API_KEY)."}
            {salvo.success && p.aiInsightsEm && ` Última geração: ${formatarData(p.aiInsightsEm)}.`}
          </p>
          {ia && gestao && liberado && <BotaoPesquisa acao="insights" id={p.id} variante="primario" />}
        </div>
        {salvo.success ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao className="p-5 lg:col-span-2">
              <h3 className="font-heading font-bold">Resumo executivo</h3>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{salvo.data.resumo_executivo}</p>
            </Cartao>
            {(
              [
                ["Pontos fortes", salvo.data.pontos_fortes],
                ["Pontos de atenção", salvo.data.pontos_atencao],
                ["Riscos", salvo.data.riscos],
              ] as const
            ).map(([t, l]) => (
              <Cartao key={t} className="p-5">
                <h3 className="font-heading font-bold">{t}</h3>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
                  {l.length ? l.map((x, i) => <li key={i}>{x}</li>) : <li className="list-none text-muted-foreground">—</li>}
                </ul>
              </Cartao>
            ))}
            <Cartao className="p-5 lg:col-span-2">
              <h3 className="font-heading font-bold">Plano de ação sugerido</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Ação</th>
                      <th className="pb-2 font-medium">Prioridade</th>
                      <th className="pb-2 font-medium">Prazo</th>
                      <th className="pb-2 font-medium">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salvo.data.plano_acao.map((a, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-2 pr-3">{a.acao}</td>
                        <td className="py-2 pr-3">{a.prioridade}</td>
                        <td className="py-2 pr-3">{a.prazo_sugerido}</td>
                        <td className="py-2">{a.responsavel_sugerido}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">
            {!liberado ? "Disponível após o encerramento da pesquisa anônima." : ia ? "Nenhum insight gerado ainda." : "Nenhum insight disponível."}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <Link href="/pulse" className="hover:text-foreground">
              Pulse
            </Link>{" "}
            / Pesquisa
          </p>
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-xl font-bold">
            {p.titulo} <Selo tom={STATUS_PESQUISA[p.status].tom}>{STATUS_PESQUISA[p.status].nome}</Selo>
            <Selo tom={p.anonima ? "info" : "neutro"}>{p.anonima ? "Anônima" : "Identificada"}</Selo>
          </h2>
          {p.descricao && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{p.descricao}</p>}
        </div>
        {gestao && (
          <div className="flex flex-wrap gap-2">
            {p.status === "rascunho" && (
              <>
                <Link href={`/pulse/${p.id}/editar`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                  <Pencil className="size-4" aria-hidden /> Editar
                </Link>
                <BotaoPesquisa acao="enviar" id={p.id} variante="primario" />
                <BotaoPesquisa acao="excluir" id={p.id} variante="perigo" aoConcluir="lista" />
              </>
            )}
            {p.status === "aberta" && (
              <>
                <CopiarLink url={urlResposta(p.id)} />
                <BotaoPesquisa acao="lembretes" id={p.id} />
                <BotaoPesquisa acao="encerrar" id={p.id} variante="perigo" />
              </>
            )}
            <BotaoPesquisa acao="duplicar" id={p.id} aoConcluir="abrir" />
            {p.status !== "rascunho" && <SalvarModelo id={p.id} sugestao={p.titulo} />}
            {p.status !== "rascunho" && pode(ctx, "pulse", "exportar") === "todos" && <LinkExportar href={`/pulse/${p.id}/exportar`} />}
          </div>
        )}
      </div>

      {p.status !== "rascunho" && (
        <nav aria-label="Seções da pesquisa" className="max-w-full overflow-x-auto">
          <ul className="flex w-max gap-1 rounded-md border border-border bg-card p-1 shadow-surface">
            {abasVisiveis.map((a) => (
              <li key={a}>
                <Link
                  href={`/pulse/${p.id}?tab=${a}`}
                  aria-current={aba === a ? "page" : undefined}
                  className={cn("inline-flex h-8 items-center rounded-sm px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground", aba === a && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
                >
                  {ABAS[a]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {conteudo}
    </>
  );
}
