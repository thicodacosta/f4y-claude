import Link from "next/link";
import { Wallet, TrendingUp, Target, UsersRound, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarList } from "@/components/dashboard/bar-list";
import { RevenueLineChart } from "@/components/dashboard/revenue-line-chart";
import { AlertList } from "@/components/intelligence/alert-list";
import {
  getReceitaConsolidada,
  getReceitaMensalConsolidada,
  getPipelineConsolidado,
  getCapacidadeAlocacao,
  getConcentracaoReceita,
  getReceitaPorVerticalNegocio,
} from "@/modules/intelligence/metrics";
import { getAlertasInteligentes } from "@/modules/intelligence/alerts";
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
  const [receita, receitaMensal, pipeline, capacidade, concentracao, receitaPorVertical, funilComercial, funilVagas, alertas] =
    await Promise.all([
      getReceitaConsolidada(),
      getReceitaMensalConsolidada(6),
      getPipelineConsolidado(),
      getCapacidadeAlocacao(),
      getConcentracaoReceita(5),
      getReceitaPorVerticalNegocio(),
      getFunilComercial(),
      getFunilVagasComValor(),
      getAlertasInteligentes(),
    ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Find4You Executive Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada das três verticais — Alocação, Recrutamento &amp; Seleção e Executive Search.
          </p>
        </div>
        <Link href="/intelligence/ceo" className="text-sm text-primary underline underline-offset-2">
          Modo CEO →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Receita do mês" value={currency.format(receita.receitaMes)} hint={`${receita.negociosFechadosMes} fechamento(s)`} icon={Wallet} />
        <KpiCard label="Receita YTD" value={currency.format(receita.receitaYtd)} icon={Wallet} />
        <KpiCard label="Pipeline total" value={currency.format(pipeline.pipelineTotal)} icon={TrendingUp} />
        <KpiCard label="Pipeline ponderado" value={currency.format(pipeline.pipelinePonderado)} hint="por probabilidade da etapa" icon={Target} />
        <KpiCard
          label="Capacidade Alocação"
          value={capacidade.posicoesTotal > 0 ? `${capacidade.posicoesPreenchidas}/${capacidade.posicoesTotal}` : "Sem dados"}
          hint={capacidade.utilizacao != null ? `${percent(capacidade.utilizacao)} ocupada` : "Nenhuma vaga de Alocação ativa"}
          icon={UsersRound}
        />
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
