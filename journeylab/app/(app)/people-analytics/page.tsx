import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeCheck,
  BrainCircuit,
  Briefcase,
  CircleDollarSign,
  Clock,
  DoorOpen,
  Gauge,
  HeartPulse,
  Info,
  Lightbulb,
  ListChecks,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje } from "@/lib/datas";
import { iaDisponivel } from "@/lib/ia";
import { uuidOuNada } from "@/lib/validacao";
import { formatarNumero } from "@/lib/formato";
import { carregarPeopleAnalytics } from "@/lib/analytics/indicadores";
import { paramsPeriodo, resolverPeriodo, variacao } from "@/lib/analytics/calculo";
import { comparativo, gerarAcoesNecessarias, gerarInsights, type Severidade } from "@/lib/analytics/insights";
import { valorReferencia } from "@/lib/analytics/referencias";
import { nomeMotivo } from "@/lib/offboarding/motivos";
import { ETAPAS_PIPELINE, type EtapaPipeline } from "@/lib/crm/pipeline";
import { CabecalhoCartao, Cartao, LinkExportar } from "@/components/app/painel";
import { Selo } from "@/components/app/lista";
import { FiltroPeriodo } from "@/components/analytics/filtro-periodo";
import { AnaliseIaPeople } from "@/components/analytics/analise-ia";
import { BarrasHorizontais, COR, Distribuicao, Funil, GraficoLinha, GraficoMovimentacao, Indicador, Variacao, formatarIndicador as f } from "@/components/analytics/graficos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "People Analytics" };

const SEV: Record<Severidade, { nome: string; tom: "perigo" | "alerta" | "sucesso" | "info"; icone: typeof Info }> = {
  critico: { nome: "Crítico", tom: "perigo", icone: AlertTriangle },
  atencao: { nome: "Atenção", tom: "alerta", icone: AlertTriangle },
  info: { nome: "Leitura", tom: "info", icone: Lightbulb },
  positivo: { nome: "Positivo", tom: "sucesso", icone: BadgeCheck },
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const meses = (m: number | null) => (m === null ? "—" : m >= 12 ? `${formatarNumero(m / 12, 1)} anos` : `${formatarNumero(m, 0)} meses`);

function Secao({ id, titulo, descricao, icone: Icone, children }: { id: string; titulo: string; descricao?: string; icone: typeof Info; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icone className="size-5 text-teal-strong" aria-hidden />
        <h2 id={id} className="font-heading text-lg font-bold">
          {titulo}
        </h2>
      </div>
      {descricao && <p className="-mt-2 text-sm text-muted-foreground">{descricao}</p>}
      {children}
    </section>
  );
}

function SemModulo({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

export default async function PeopleAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, db } = await exigirModulo("analytics");
  const sp = await searchParams;
  const periodo = resolverPeriodo(sp, hoje());
  const areaId = uuidOuNada(sp.area) ?? null;
  const d = await carregarPeopleAnalytics(ctx, periodo, areaId);
  const entrevistasPendentes =
    ctx.modulos.has("offboarding") && pode(ctx, "offboarding", "visualizar") ? await db.desligamento.count({ where: { entrevistaStatus: { in: ["pendente", "enviada"] } } }) : 0;
  const insights = gerarInsights(d);
  const acoes = gerarAcoesNecessarias(d, { entrevistasPendentes });
  const comp = comparativo(d);
  const t = d.turnover;
  const a = d.turnoverAnterior;
  const area = areaId ? d.areas.find((x) => x.id === areaId)?.nome : null;
  const params = { ...paramsPeriodo(periodo), ...(areaId ? { area: areaId } : {}) };
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  const refMensal = valorReferencia(d.config, "turnoverAnual") / 12;
  const riscoAlto = d.riscos?.filter((r) => r.nivel === "alto").length ?? 0;
  const posicoes = d.atracao?.posicoesAbertas ?? 0;
  const hcProjetado = d.projecao ? Math.round(d.pessoas.headcount + posicoes - d.projecao.esperado) : null;

  return (
    <>
      <FiltroPeriodo periodo={periodo.chave} de={periodo.inicio.toISOString().slice(0, 10)} ate={periodo.fim.toISOString().slice(0, 10)} area={areaId} areas={d.areas} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{periodo.rotulo}</strong> ({periodo.inicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a {periodo.fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}) ·{" "}
          {area ? `Área: ${area}` : "Organização inteira"} · comparação com os {periodo.dias} dias anteriores
        </p>
        {pode(ctx, "analytics", "exportar") && <LinkExportar href={`/people-analytics/exportar?${qs}`}>Exportar indicadores</LinkExportar>}
      </div>

      {/* 1. Resumo executivo */}
      <Secao id="resumo" titulo="Resumo executivo" icone={Gauge}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador
            rotulo="Headcount"
            valor={String(d.pessoas.headcount)}
            icone={Users}
            variacao={<Variacao valor={d.pessoas.headcount - d.pessoas.headcountAnterior} rotulo="vs. fim do período anterior" />}
            detalhe={`${d.pessoas.headcountHa12m} há 12 meses`}
            href="/colaboradores"
          />
          <Indicador
            rotulo="Turnover anualizado"
            valor={`${f(t.turnoverAnualizado)}%`}
            icone={Repeat}
            alerta={t.turnoverAnualizado !== null && t.turnoverAnualizado > valorReferencia(d.config, "turnoverAnual")}
            variacao={<Variacao valor={variacao(t.turnoverAnualizado, a.turnoverAnualizado)} unidade=" p.p." menorMelhor />}
            detalhe={`${f(t.turnover)}% no período · referência ${valorReferencia(d.config, "turnoverAnual")}% ao ano`}
          />
          <Indicador
            rotulo="Turnover voluntário (anualizado)"
            valor={`${f(t.turnoverVoluntarioAnualizado)}%`}
            icone={UserMinus}
            variacao={<Variacao valor={variacao(t.turnoverVoluntarioAnualizado, a.turnoverVoluntarioAnualizado)} unidade=" p.p." menorMelhor />}
            detalhe={`${t.voluntarias} voluntária(s) · ${t.involuntarias} involuntária(s)${t.semClassificacao ? ` · ${t.semClassificacao} sem registro` : ""}`}
          />
          <Indicador rotulo="Retenção em 12 meses" valor={`${f(d.pessoas.retencao12m)}%`} icone={ShieldCheck} detalhe={`Referência ${valorReferencia(d.config, "retencao12m")}%`} progresso={d.pessoas.retencao12m} />
          <Indicador rotulo="Admissões" valor={String(d.pessoas.admissoes)} icone={UserPlus} variacao={<Variacao valor={d.pessoas.admissoes - d.pessoas.admissoesAnterior} />} detalhe={`Rotatividade geral: ${f(t.rotatividadeGeral)}%`} />
          <Indicador
            rotulo="Saídas"
            valor={String(t.saidas)}
            icone={TrendingDown}
            variacao={<Variacao valor={t.saidas - a.saidas} menorMelhor />}
            detalhe={`${t.lamentadas} perda(s) lamentada(s) · ${t.precoces} com menos de 90 dias`}
            alerta={t.lamentadas > 0}
            href={ctx.modulos.has("offboarding") && pode(ctx, "offboarding", "visualizar") ? "/offboarding" : undefined}
          />
          <Indicador rotulo="Tempo médio de casa" valor={meses(d.pessoas.tempoMedioCasaMeses)} icone={Clock} detalhe={`Na saída: ${meses(t.tempoMedioCasaSaidaMeses)}`} />
          {d.custo ? (
            <Indicador rotulo="Custo estimado do turnover" valor={brl(d.custo.total)} icone={CircleDollarSign} detalhe={`${brl(d.custo.porSaida)} por reposição (premissa)`} />
          ) : (
            <Indicador
              rotulo="Custo estimado do turnover"
              valor="—"
              icone={CircleDollarSign}
              detalhe="Configure salário médio e custo de reposição em Referências."
              href={pode(ctx, "analytics", "editar") ? "/people-analytics/referencias" : undefined}
            />
          )}
        </div>
      </Secao>

      {/* 2. Inteligência */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Cartao aria-labelledby="insights">
          <CabecalhoCartao id="insights" titulo="Insights" descricao="Leituras automáticas por regras explícitas — cada uma diz de onde veio e o que fazer." />
          <ul className="flex flex-col gap-3 px-5 pb-5">
            {insights.length === 0 && <li className="text-sm text-muted-foreground">Nenhum ponto de atenção com os dados do período. Amplie o período para mais histórico.</li>}
            {insights.map((i) => {
              const s = SEV[i.severidade];
              return (
                <li key={i.id} className={cn("rounded-lg border p-4", i.severidade === "critico" ? "border-destructive/30 bg-destructive/5" : i.severidade === "atencao" ? "border-warning/40 bg-warning/5" : "border-border")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo tom={s.tom}>{s.nome}</Selo>
                    <span className="text-xs font-medium text-muted-foreground uppercase">{i.tema}</span>
                  </div>
                  <p className="mt-2 font-semibold">{i.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{i.texto}</p>
                  <p className="mt-2 text-sm">
                    <strong>Recomendação:</strong> {i.recomendacao}{" "}
                    {i.href && (
                      <Link href={i.href} className="font-medium text-teal-strong hover:underline">
                        {i.rotuloLink ?? "Abrir"} →
                      </Link>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </Cartao>
        <div className="flex flex-col gap-4">
          <Cartao aria-labelledby="acoes-necessarias">
            <CabecalhoCartao id="acoes-necessarias" titulo="Ações necessárias" descricao="Priorizadas: 1 = esta semana · 2 = este mês · 3 = no trimestre." />
            <ol className="flex flex-col gap-1 px-3 pb-4">
              {acoes.length === 0 && <li className="px-2 text-sm text-muted-foreground">Nada pendente. Bom trabalho.</li>}
              {acoes.map((x) => (
                <li key={x.id}>
                  <Link href={x.href} className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        x.prioridade === 1 ? "bg-destructive/10 text-destructive" : x.prioridade === 2 ? "bg-warning/15 text-warning-foreground dark:text-warning" : "bg-muted text-muted-foreground",
                      )}
                      aria-label={`Prioridade ${x.prioridade}`}
                    >
                      {x.prioridade}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{x.titulo}</span>
                      <span className="block text-xs text-muted-foreground">{x.detalhe}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Cartao>
          <Cartao aria-labelledby="preditiva">
            <CabecalhoCartao id="preditiva" titulo="Análise preditiva — próximos 90 dias" descricao="Tendência para planejamento; não prevê quem vai sair." />
            <div className="flex flex-col gap-3 px-5 pb-5 text-sm">
              {d.projecao ? (
                <>
                  <p>
                    Saídas esperadas: <strong className="font-heading text-xl">{formatarNumero(d.projecao.esperado, 1)}</strong>{" "}
                    <span className="text-muted-foreground">
                      (entre {d.projecao.minimo} e {d.projecao.maximo})
                    </span>
                  </p>
                  <p>
                    Turnover anualizado projetado: <strong>{f(d.projecao.turnoverAnualizado)}%</strong>
                    {d.projecao.fator > 1 && <span className="text-muted-foreground"> · ajustado +{Math.round((d.projecao.fator - 1) * 100)}% pelo risco alto ({riscoAlto} pessoa(s))</span>}
                  </p>
                  {hcProjetado !== null && (
                    <p>
                      Headcount projetado: <strong>{hcProjetado}</strong> <span className="text-muted-foreground">(hoje {d.pessoas.headcount} + {posicoes} posição(ões) abertas − saídas esperadas)</span>
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    {d.tendencia > 0.2 ? <TrendingUp className="size-4 text-destructive" aria-hidden /> : d.tendencia < -0.2 ? <TrendingDown className="size-4 text-success" aria-hidden /> : <Scale className="size-4 text-muted-foreground" aria-hidden />}
                    Tendência do turnover mensal: <strong>{d.tendencia > 0.2 ? "alta" : d.tendencia < -0.2 ? "queda" : "estável"}</strong>
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Sem histórico suficiente para projetar.</p>
              )}
              {d.riscos && (
                <Distribuicao
                  partes={[
                    { rotulo: "Risco alto", n: riscoAlto, cor: COR.perigo },
                    { rotulo: "Médio", n: d.riscos.filter((r) => r.nivel === "medio").length, cor: COR.alerta },
                    { rotulo: "Baixo", n: d.riscos.filter((r) => r.nivel === "baixo").length, cor: COR.sucesso },
                  ]}
                />
              )}
              {d.riscos && (
                <Link href="/retencao/risco" className="text-sm font-medium text-teal-strong hover:underline">
                  Ver risco de saída por pessoa →
                </Link>
              )}
            </div>
          </Cartao>
        </div>
      </div>

      <Cartao aria-labelledby="ia">
        <CabecalhoCartao id="ia" titulo="Análise executiva com IA" descricao="Narrativa para diretoria a partir dos indicadores agregados deste filtro." />
        <div className="px-5 pb-5">
          <AnaliseIaPeople params={params} disponivel={iaDisponivel()} />
        </div>
      </Cartao>

      {/* 3. Movimentação e turnover */}
      <Secao id="turnover" titulo="Movimentação e turnover" icone={Repeat} descricao="Série mensal dos últimos 12 meses (ou do período, se maior).">
        <div className="grid gap-4 xl:grid-cols-2">
          <Cartao>
            <CabecalhoCartao titulo="Admissões, saídas e headcount" />
            <div className="px-5 pb-5">
              <GraficoMovimentacao pontos={d.serie} />
            </div>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Turnover mensal" descricao="Saídas do mês ÷ headcount médio do mês" />
            <div className="px-5 pb-5">
              <GraficoLinha pontos={d.serie.map((p) => ({ rotulo: p.rotulo, valor: p.turnover }))} referencia={Math.round(refMensal * 10) / 10} rotuloReferencia="Referência mensal" />
            </div>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Turnover por área" descricao="Anualizado no período" />
            <div className="px-5 pb-5">
              <BarrasHorizontais
                unidade="%"
                tom="navy"
                itens={d.porArea.map((x) => ({ rotulo: x.nome, valor: x.turnoverAnualizado ?? 0, detalhe: `${x.saidas} saída(s) · ${x.headcount} pessoa(s)`, destaque: (x.turnoverAnualizado ?? 0) >= (t.turnoverAnualizado ?? 0) * 1.5 && x.saidas >= 2 }))}
                vazio="Cadastre áreas nas equipes para ver o recorte."
              />
            </div>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Saídas por tempo de casa" descricao="Onde a jornada está se rompendo" />
            <div className="px-5 pb-5">
              <BarrasHorizontais tom="perigo" itens={d.casa.map((c) => ({ rotulo: c.nome, valor: c.n }))} vazio="Sem saídas no período." />
            </div>
          </Cartao>
        </div>
      </Secao>

      {/* 4. Motivos de saída */}
      <Secao id="motivos" titulo="Por que as pessoas saem" icone={DoorOpen} descricao="Entrevistas de desligamento (agregado; respostas individuais ficam no Offboarding).">
        {d.saida ? (
          <div className="grid gap-4 xl:grid-cols-3">
            <Cartao>
              <CabecalhoCartao titulo="Motivos reais (entrevista)" descricao={`${d.saida.entrevistadas} entrevista(s) · taxa de resposta ${f(d.saida.taxaEntrevista)}%`} />
              <div className="px-5 pb-5">
                <BarrasHorizontais itens={d.saida.motivosReais.map((m) => ({ rotulo: nomeMotivo(m.chave), valor: m.n }))} vazio="Nenhuma entrevista respondida no período." />
              </div>
            </Cartao>
            <Cartao>
              <CabecalhoCartao titulo="Motivos informados no desligamento" descricao={d.saida.divergencia !== null ? `Divergem do motivo real em ${f(d.saida.divergencia)}% dos casos` : undefined} />
              <div className="px-5 pb-5">
                <BarrasHorizontais tom="navy" itens={d.saida.motivosDeclarados.map((m) => ({ rotulo: nomeMotivo(m.chave), valor: m.n }))} vazio="Nenhum desligamento registrado no período." />
              </div>
            </Cartao>
            <Cartao>
              <CabecalhoCartao titulo="Experiência avaliada por quem saiu" descricao={`Média de 1 a 5 · eNPS de saída ${d.saida.enps ?? "—"} · evitável em ${f(d.saida.evitavel)}%`} />
              <div className="px-5 pb-5">
                <BarrasHorizontais
                  max={5}
                  itens={d.saida.experiencia.filter((e) => e.media !== null).map((e) => ({ rotulo: e.nome, valor: e.media!, destaque: e.media! < 3 }))}
                  vazio="Sem entrevistas no período."
                />
              </div>
            </Cartao>
          </div>
        ) : (
          <SemModulo texto="Ative o Offboarding para registrar desligamentos e entrevistas de saída e entender os motivos reais." />
        )}
      </Secao>

      {/* 5. Atração e seleção */}
      <Secao id="atracao" titulo="Atração e seleção" icone={Briefcase}>
        {d.atracao ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Indicador rotulo="Vagas abertas" valor={String(d.atracao.vagasAbertas)} icone={Briefcase} detalhe={`${d.atracao.posicoesAbertas} posição(ões) · ${d.atracao.vagasAtrasadas} com prazo vencido`} alerta={d.atracao.vagasAtrasadas > 0} href="/pipeline-vagas" />
              <Indicador rotulo="Candidaturas" valor={String(d.atracao.candidaturas)} icone={UserPlus} variacao={<Variacao valor={d.atracao.candidaturas - d.atracao.candidaturasAnterior} />} detalhe={`${f(d.atracao.viaCarreiras)}% pela Página de Carreiras`} />
              <Indicador rotulo="Tempo para preencher" valor={d.atracao.timeToFill === null ? "—" : `${Math.round(d.atracao.timeToFill)} d`} icone={Clock} detalhe={`Referência ${valorReferencia(d.config, "timeToFill")} dias`} />
              <Indicador rotulo="Contratações" valor={String(d.atracao.contratacoes)} icone={BadgeCheck} detalhe={d.atracao.timeToHire === null ? "—" : `${Math.round(d.atracao.timeToHire)} dias da candidatura à contratação`} />
            </div>
            <Cartao>
              <CabecalhoCartao titulo="Funil de candidaturas do período" descricao="Etapa alcançada · % de conversão da etapa anterior" />
              <div className="flex flex-col gap-4 px-5 pb-5">
                <Funil etapas={d.atracao.funil} />
                {d.atracao.etapas.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Vagas por etapa do pipeline: {d.atracao.etapas.map((e) => `${ETAPAS_PIPELINE[e.chave as EtapaPipeline]?.nome ?? e.chave} ${e.n}`).join(" · ")}
                  </p>
                )}
              </div>
            </Cartao>
          </div>
        ) : (
          <SemModulo texto="CRM de Candidatos não ativo ou sem permissão para a organização inteira." />
        )}
      </Secao>

      {/* 6. Desenvolvimento */}
      <Secao id="desenvolvimento" titulo="Desenvolvimento" icone={Sparkles}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Cartao>
            <CabecalhoCartao titulo="Onboarding" />
            <div className="flex flex-col gap-2 px-5 pb-5 text-sm">
              {d.onboarding ? (
                <>
                  <p>
                    <strong className="font-heading text-2xl">{f(d.onboarding.noPrazo)}%</strong> concluídos no prazo
                  </p>
                  <p className="text-muted-foreground">
                    {d.onboarding.iniciados} iniciado(s) · {d.onboarding.concluidos} concluído(s) · {d.onboarding.emAndamento} em andamento ({f(d.onboarding.progressoMedio)}% de progresso médio)
                  </p>
                  <p className={d.onboarding.tarefasAtrasadas ? "font-medium text-destructive" : "text-muted-foreground"}>{d.onboarding.tarefasAtrasadas} tarefa(s) atrasada(s)</p>
                </>
              ) : (
                <p className="text-muted-foreground">Módulo não ativo ou sem permissão.</p>
              )}
            </div>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Feedback 1:1" />
            <div className="flex flex-col gap-3 px-5 pb-5 text-sm">
              {d.feedback ? (
                <>
                  <p>
                    <strong className="font-heading text-2xl">{f(d.feedback.cobertura90d)}%</strong> com feedback nos últimos 90 dias
                  </p>
                  <p className="text-muted-foreground">
                    {d.feedback.avaliacoes} feedback(s) no período · média {f(d.feedback.mediaGeral)}
                    {d.feedback.mediaAnterior !== null && ` (antes ${f(d.feedback.mediaAnterior)})`} · {d.feedback.reunioes} 1:1 realizado(s)
                  </p>
                  <Distribuicao
                    partes={[
                      { rotulo: "Verde", n: d.feedback.semaforo.verde ?? 0, cor: COR.sucesso },
                      { rotulo: "Amarelo", n: d.feedback.semaforo.amarelo ?? 0, cor: COR.alerta },
                      { rotulo: "Vermelho", n: d.feedback.semaforo.vermelho ?? 0, cor: COR.perigo },
                    ]}
                  />
                </>
              ) : (
                <p className="text-muted-foreground">Módulo não ativo ou sem permissão.</p>
              )}
            </div>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="PDI" />
            <div className="flex flex-col gap-2 px-5 pb-5 text-sm">
              {d.pdi ? (
                <>
                  <p>
                    <strong className="font-heading text-2xl">{f(d.pdi.cobertura)}%</strong> das pessoas com PDI ativo
                  </p>
                  <p className="text-muted-foreground">
                    {d.pdi.emAndamento} plano(s) em andamento · {f(d.pdi.progressoMedio)}% de progresso médio · {d.pdi.acoesConcluidas} ação(ões) concluída(s) no período
                  </p>
                  <p className={d.pdi.emRisco ? "font-medium text-destructive" : "text-muted-foreground"}>{d.pdi.emRisco} plano(s) em risco</p>
                </>
              ) : (
                <p className="text-muted-foreground">Módulo não ativo ou sem permissão.</p>
              )}
            </div>
          </Cartao>
        </div>
      </Secao>

      {/* 7. Saúde */}
      <Secao id="saude" titulo="Saúde do colaborador" icone={HeartPulse} descricao={areaId ? "Pulse e NR-1 não são recortados por área aqui (respeitam o mínimo de respondentes de cada módulo)." : undefined}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao>
            <CabecalhoCartao titulo="Pulse" />
            <div className="flex flex-col gap-2 px-5 pb-5 text-sm">
              {d.pulse ? (
                <>
                  <p>
                    eNPS de clima: <strong className="font-heading text-2xl">{d.pulse.enps ?? "—"}</strong>
                    {d.pulse.enpsPesquisa && <span className="text-muted-foreground"> · {d.pulse.enpsPesquisa}</span>}
                  </p>
                  <p className="text-muted-foreground">
                    {d.pulse.pesquisas} pesquisa(s) no período · adesão média {f(d.pulse.adesao)}%
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">{areaId ? "Disponível na visão da organização inteira." : "Módulo não ativo ou sem permissão."}</p>
              )}
            </div>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Diagnóstico NR-1" />
            <div className="flex flex-col gap-2 px-5 pb-5 text-sm">
              {d.nr1 ? (
                <>
                  <p>
                    <strong className="font-heading text-2xl">{d.nr1.riscosAltos}</strong> risco(s) de prioridade alta em aberto
                  </p>
                  <p className="text-muted-foreground">
                    {d.nr1.acoesAbertas} medida(s) em aberto · {d.nr1.acoesAtrasadas} atrasada(s){d.nr1.ultimoCiclo && ` · último ciclo: ${d.nr1.ultimoCiclo}`}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">{areaId ? "Disponível na visão da organização inteira." : "Módulo não ativo ou sem permissão."}</p>
              )}
            </div>
          </Cartao>
        </div>
      </Secao>

      {/* 8. Comparativo */}
      <Secao id="comparativo" titulo="Comparativo de mercado" icone={Scale} descricao="Indicadores dos últimos 12 meses frente às referências configuradas pela organização.">
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left">
              <tr>
                {["Indicador", "Sua empresa", "Referência", "Diferença", "Leitura"].map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comp.map((c) => (
                <tr key={c.chave}>
                  <td className="px-4 py-3 first:pl-5">
                    <span className="font-medium">{c.nome}</span>
                    <span className="block text-xs text-muted-foreground">{c.ajuda}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.valor === null ? "—" : `${f(c.valor)} ${c.unidade}`}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {f(c.referencia)} {c.unidade}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.valor === null ? "—" : `${c.valor - c.referencia > 0 ? "+" : ""}${f(Math.round((c.valor - c.referencia) * 10) / 10)}`}</td>
                  <td className="px-4 py-3">
                    {c.leitura === null ? (
                      <Selo>Sem dados</Selo>
                    ) : c.leitura === "melhor" ? (
                      <Selo tom="sucesso">Melhor que a referência</Selo>
                    ) : c.leitura === "em_linha" ? (
                      <Selo tom="info">Em linha</Selo>
                    ) : (
                      <Selo tom="perigo">Abaixo da referência</Selo>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {d.config.fonte ? `Fonte das referências: ${d.config.fonte}${d.config.setor ? ` · setor ${d.config.setor}` : ""}. ` : "Referências iniciais do JourneyLab (pontos de partida, não dados oficiais). "}
          {pode(ctx, "analytics", "editar") && (
            <Link href="/people-analytics/referencias" className="font-medium text-teal-strong hover:underline">
              Ajustar referências do seu setor →
            </Link>
          )}
        </p>
      </Secao>

      <details className="rounded-lg border border-border bg-card p-5 text-sm shadow-surface">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <BrainCircuit className="size-4 text-teal-strong" aria-hidden /> Metodologia e fórmulas
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>Headcount: pessoas com admissão até a data e sem saída até ela (pré-admissão não entra). Sem data de admissão, vale a data de cadastro.</li>
          <li>Turnover: saídas no período ÷ headcount médio (início + fim ÷ 2). Anualizado: × 365 ÷ dias do período.</li>
          <li>Rotatividade geral: ((admissões + saídas) ÷ 2) ÷ headcount médio — fórmula clássica usada no Brasil.</li>
          <li>Retenção em 12 meses: das pessoas ativas há 12 meses, a parcela que segue ativa.</li>
          <li>Saídas voluntárias: tipo de desligamento por iniciativa do colaborador (registro do Offboarding). Desligamentos feitos só no cadastro ficam “sem registro”.</li>
          <li>Projeção 90 dias: média mensal ponderada dos últimos 6 meses × 3, ajustada pela parcela de pessoas em risco alto; intervalo aproximado de 90%.</li>
          <li>Risco de saída: pontuação indicativa por sinais (feedback, PDI, onboarding, tempo de casa, liderança e área), descrita em Retenção. Não é decisão automatizada sobre pessoas.</li>
          <li>Pulse e NR-1 usam somente resultados agregados liberados (mínimo de respondentes da organização).</li>
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListChecks className="size-3.5" aria-hidden /> Cada seção só aparece se o módulo de origem estiver ativo e o seu papel puder ver os dados da organização inteira.
        </p>
      </details>
    </>
  );
}
