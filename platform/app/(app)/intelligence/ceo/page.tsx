import Link from "next/link";
import { Wallet, TrendingUp, Target, PieChart, UsersRound, AlertTriangle, Sparkles } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  getReceitaConsolidada,
  getReceitaMensalConsolidada,
  calcularCrescimentoMoM,
  getPipelineConsolidado,
  getCapacidadeAlocacao,
  getConcentracaoReceita,
  getReceitaPorVerticalNegocio,
  getMargemEstimada,
} from "@/modules/intelligence/metrics";
import { getAlertasInteligentes } from "@/modules/intelligence/alerts";
import { gerarInsightsCeo } from "@/modules/intelligence/insights";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (n: number) => `${n.toFixed(0)}%`;

export default async function CeoIntelligencePage() {
  const [receita, receitaMensal, pipeline, capacidade, concentracao, receitaPorVertical, margem, alertas] = await Promise.all([
    getReceitaConsolidada(),
    getReceitaMensalConsolidada(6),
    getPipelineConsolidado(),
    getCapacidadeAlocacao(),
    getConcentracaoReceita(5),
    getReceitaPorVerticalNegocio(),
    getMargemEstimada(),
    getAlertasInteligentes(),
  ]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Find4You — CEO</h1>
          <p className="text-sm text-muted-foreground">O essencial, em uma tela.</p>
        </div>
        <Link href="/intelligence" className="text-sm text-primary underline underline-offset-2">
          Ver detalhes completos →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Receita"
          value={currency.format(receita.receitaMes)}
          hint={crescimentoMoM != null ? `${crescimentoMoM >= 0 ? "+" : ""}${crescimentoMoM.toFixed(0)}% vs. mês anterior` : "mês atual"}
          icon={Wallet}
        />
        <KpiCard label="Pipeline" value={currency.format(pipeline.pipelineTotal)} hint={`${currency.format(pipeline.pipelinePonderado)} ponderado`} icon={TrendingUp} />
        <KpiCard
          label="Margem estimada"
          value={margem.margemPercentual != null ? percent(margem.margemPercentual) : "Sem dados"}
          hint="receita − comissões geradas"
          icon={PieChart}
        />
        <KpiCard
          label="Capacidade Alocação"
          value={capacidade.utilizacao != null ? percent(capacidade.utilizacao) : "Sem dados"}
          hint={capacidade.posicoesTotal > 0 ? `${capacidade.posicoesPreenchidas}/${capacidade.posicoesTotal} posições` : undefined}
          icon={UsersRound}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Concentração de receita"
          value={concentracao ? percent(concentracao.percentual) : "Sem dados"}
          hint={concentracao ? `top ${concentracao.topN} clientes` : "aguardando faturamento"}
          icon={AlertTriangle}
        />
        <KpiCard label="Alertas ativos" value={String(alertas.length)} hint={alertaCritico ? "há item crítico" : "nenhum crítico no momento"} icon={Target} />
      </div>

      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        Meta de empresa e Forecast estatístico ainda não existem no sistema — hoje as metas são só por consultor/recrutador
        (ver Dashboard). Entram na próxima fase do Find4You Intelligence.
      </p>

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
    </div>
  );
}
