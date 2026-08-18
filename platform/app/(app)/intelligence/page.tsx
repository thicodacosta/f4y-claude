import { Wallet, TrendingUp, Target, AlertTriangle, Sparkles, Coins } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarList } from "@/components/dashboard/bar-list";
import { RevenueLineChart } from "@/components/dashboard/revenue-line-chart";
import { AlertList } from "@/components/intelligence/alert-list";
import { ForecastView } from "@/components/intelligence/forecast-view";
import { VagasCategoriaCard } from "@/components/intelligence/vagas-categoria-card";
import {
  getReceitaConsolidada,
  getReceitaMensalConsolidada,
  calcularCrescimentoMoM,
  getPipelineConsolidado,
  getPipelineTotalPorCategoria,
  getTotalVagasPorCategoria,
  getMediaPorVagaRecrutamento,
  getCapacidadeAlocacao,
  getConcentracaoReceita,
  getReceitaPorVerticalNegocio,
} from "@/modules/intelligence/metrics";
import { getAlertasInteligentes } from "@/modules/intelligence/alerts";
import { gerarInsightsCeo } from "@/modules/intelligence/insights";
import { getForecastMultiplasJanelas, getGapToGoal } from "@/modules/intelligence/forecast";
import { categoriaMetaValues } from "@/modules/metas/schemas";
import { getFunilComercial } from "@/modules/dashboard/queries";
import { getFunilVagasComValor } from "@/modules/ats/queries";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (n: number) => `${n.toFixed(0)}%`;

const VERTICAL_LABEL: Record<string, string> = {
  alocacao: "Alocação de Profissionais",
  recrutamento: "Recrutamento & Seleção",
  executive_search: "Executive Search",
};

export default async function IntelligencePage() {
  const [
    receita,
    receitaMensal,
    pipeline,
    pipelinePorCategoria,
    vagasPorCategoria,
    mediaPorVaga,
    capacidade,
    concentracao,
    receitaPorVertical,
    funilComercial,
    funilVagas,
    alertas,
    janelasForecast,
    gapsForecast,
  ] = await Promise.all([
    getReceitaConsolidada(),
    getReceitaMensalConsolidada(6),
    getPipelineConsolidado(),
    getPipelineTotalPorCategoria(),
    getTotalVagasPorCategoria(),
    getMediaPorVagaRecrutamento(),
    getCapacidadeAlocacao(),
    getConcentracaoReceita(5),
    getReceitaPorVerticalNegocio(),
    getFunilComercial(),
    getFunilVagasComValor(),
    getAlertasInteligentes(),
    getForecastMultiplasJanelas(),
    Promise.all(categoriaMetaValues.map((categoria) => getGapToGoal(categoria))),
  ]);
  const PONDERADO_PERCENT = 0.2;
  const gapsValidos = gapsForecast.filter((g): g is NonNullable<typeof g> => g != null);

  const crescimentoMoM = calcularCrescimentoMoM(receitaMensal);
  const alertaCritico = alertas.find((a) => a.severidade === "critico") ?? null;
  const insights = gerarInsightsCeo({
    crescimentoMoM,
    concentracao: concentracao ? { percentual: concentracao.percentual, topN: concentracao.topN } : null,
    utilizacaoCapacidade: capacidade.utilizacao,
    receitaPorVertical,
    alertaCritico,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Find4You Executive Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada das três verticais — Alocação, Recrutamento &amp; Seleção e Executive Search.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Receita do mês"
          value={currency.format(receita.receitaMes)}
          hint={
            crescimentoMoM != null
              ? `${crescimentoMoM >= 0 ? "+" : ""}${crescimentoMoM.toFixed(0)}% vs. mês anterior`
              : `${receita.negociosFechadosMes} fechamento(s)`
          }
          icon={Wallet}
        />
        <KpiCard label="Receita YTD" value={currency.format(receita.receitaYtd)} icon={Wallet} />
        <KpiCard label="Pipeline total" value={currency.format(pipeline.pipelineTotal)} icon={TrendingUp} />
        <KpiCard
          label="Pipeline ponderado — Alocação"
          value={currency.format(pipelinePorCategoria.alocacao * PONDERADO_PERCENT)}
          hint="20% do pipeline aberto"
          icon={Target}
          tooltip="Estimativa fixa: 20% do valor total do pipeline em aberto (CRM + Vagas) de Alocação de Profissionais."
        />
        <KpiCard
          label="Pipeline ponderado — Recrutamento"
          value={currency.format(pipelinePorCategoria.recrutamento * PONDERADO_PERCENT)}
          hint="20% do pipeline aberto"
          icon={Target}
          tooltip="Estimativa fixa: 20% do valor total do pipeline em aberto (CRM + Vagas) de Recrutamento & Seleção."
        />
        <VagasCategoriaCard vagas={vagasPorCategoria} />
        <KpiCard
          label="Média por vaga (R&S)"
          value={mediaPorVaga.media != null ? currency.format(mediaPorVaga.media) : "Sem dados"}
          hint={mediaPorVaga.contagem > 0 ? `${mediaPorVaga.contagem} vaga(s) fechada(s)` : "Nenhuma vaga fechada ainda"}
          icon={Coins}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          O que você precisa saber hoje
        </h2>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há histórico suficiente para gerar insights automáticos.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm">
            {insights.map((texto, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-muted-foreground">{i + 1}.</span>
                <span>{texto}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-heading text-sm font-semibold">Receita — últimos 6 meses</h2>
          {receitaMensal.every((d) => d.valor === 0) ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes — nenhum faturamento registrado no período.</p>
          ) : (
            <RevenueLineChart data={receitaMensal} />
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-heading text-sm font-semibold">Receita por vertical de negócio</h2>
          {!receitaPorVertical ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes — aguardando histórico de faturamento.</p>
          ) : (
            <BarList
              items={Object.entries(receitaPorVertical).map(([vertical, valor]) => ({
                id: vertical,
                label: VERTICAL_LABEL[vertical] ?? vertical,
                value: valor,
              }))}
              formatValue={(v) => currency.format(v)}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-heading text-sm font-semibold">Funil Comercial (Pipeline)</h2>
          <BarList
            items={funilComercial.map((e) => ({ id: e.id, label: e.nome, value: e.valor, color: e.cor }))}
            formatValue={(v) => currency.format(v)}
            emptyLabel="Nenhuma oportunidade cadastrada ainda."
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-heading text-sm font-semibold">Funil de Vagas</h2>
          <BarList
            items={funilVagas.map((e) => ({ id: e.id, label: e.nome, value: e.total, color: e.cor }))}
            formatValue={(v) => `${v} posiç${v === 1 ? "ão" : "ões"}`}
            emptyLabel="Nenhuma vaga cadastrada ainda."
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div>
          <h2 className="font-heading text-sm font-semibold">Forecast</h2>
          <p className="text-xs text-muted-foreground">
            Conservador (só pipeline com data e probabilidade), provável (+ tendência histórica) e agressivo (tudo
            previsto fechando).
          </p>
        </div>
        <ForecastView janelas={janelasForecast} gaps={gapsValidos} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-semibold">Concentração de receita</h2>
            {concentracao && concentracao.percentual >= 40 && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" />
                Alta dependência
              </span>
            )}
          </div>
          {!concentracao ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes — aguardando histórico de faturamento.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Os {concentracao.topN} maiores clientes representam <strong className="text-foreground">{percent(concentracao.percentual)}</strong> da receita faturada.
              </p>
              <BarList
                items={concentracao.clientes.map((c, i) => ({ id: `${i}-${c.nome}`, label: c.nome, value: c.valor }))}
                formatValue={(v) => currency.format(v)}
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-heading text-sm font-semibold">Alertas inteligentes</h2>
          <AlertList alertas={alertas} />
        </div>
      </div>
    </div>
  );
}
