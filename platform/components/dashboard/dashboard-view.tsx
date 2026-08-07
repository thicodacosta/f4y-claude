"use client";

import { Building2, Briefcase, UserRound, Users, TrendingUp, Target, Percent, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarList } from "@/components/dashboard/bar-list";
import { RevenueLineChart } from "@/components/dashboard/revenue-line-chart";
import { TarefasWidget, type TarefaClient } from "@/components/tarefas/tarefas-widget";
import { AlertasExecutivos, type AlertaVaga } from "@/components/dashboard/alertas-executivos";
import { MinhasMetas, type MinhaMetaClient } from "@/components/dashboard/minhas-metas";
import { etapaVagaCandidatoLabel, etapaVagaCandidatoCor } from "@/modules/ats/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (n: number) => `${n.toFixed(0)}%`;

type GeralData = {
  clientesAtivos: number;
  empresasProspect: number;
  vagasAbertas: number;
  candidatosAtivos: number;
};

type AlertasData = { semSourcing: AlertaVaga[]; semFecharHaMuitoTempo: AlertaVaga[] };

type ComercialData = {
  kpis: {
    oportunidadesAbertas: number;
    valorEmAberto: number;
    ganhasNoMes: number;
    valorGanhoNoMes: number;
    perdidasNoMes: number;
    valorPerdidoNoMes: number;
    taxaConversao: number;
    ticketMedio: number;
  };
  funil: { id: string; nome: string; cor: string; total: number; valor: number }[];
  forecast: { valorEmAberto: number; receitaPonderada: number; confirmadaNoMes: number; perdidaNoMes: number };
  receitaMensal: { mes: string; valor: number }[];
  topEmpresas: { id: string; nome: string; valor: number }[];
  topConsultores: { id: string; nome: string; valor: number }[];
};

type RecrutamentoData = {
  kpis: {
    vagasAbertas: number;
    fechadasNoMes: number;
    perdidasNoMes: number;
    taxaConversao: number;
    tempoMedioFechamentoDias: number | null;
  };
  funilVagas: { id: string; nome: string; cor: string; total: number }[];
  funilCandidatos: { etapa: string; total: number }[];
  topTecnologias: { tecnologia: string; total: number }[];
  topRecrutadores: { id: string; nome: string; total: number }[];
};

function Secao({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function DashboardView({
  geral,
  comercial,
  recrutamento,
  tarefas,
  alertas,
  minhasMetas,
}: {
  geral: GeralData | null;
  comercial: ComercialData | null;
  recrutamento: RecrutamentoData | null;
  tarefas: TarefaClient[];
  alertas: AlertasData | null;
  minhasMetas: MinhaMetaClient[];
}) {
  const primeiraTab = geral ? "geral" : comercial ? "comercial" : "recrutamento";

  return (
    <Tabs defaultValue={primeiraTab} className="flex flex-1 flex-col gap-4">
      <TabsList>
        {geral && <TabsTrigger value="geral">Geral</TabsTrigger>}
        {comercial && <TabsTrigger value="comercial">Comercial</TabsTrigger>}
        {recrutamento && <TabsTrigger value="recrutamento">Recrutamento</TabsTrigger>}
      </TabsList>

      {geral && (
        <TabsContent value="geral" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Clientes ativos" value={String(geral.clientesAtivos)} icon={Building2} />
            <KpiCard label="Prospects" value={String(geral.empresasProspect)} icon={Users} />
            <KpiCard label="Vagas abertas" value={String(geral.vagasAbertas)} icon={Briefcase} />
            <KpiCard label="Candidatos ativos" value={String(geral.candidatosAtivos)} icon={UserRound} />
          </div>
          <Secao title="Minhas metas">
            <MinhasMetas metas={minhasMetas} />
          </Secao>
          {alertas && (
            <Secao title="Alertas executivos">
              <AlertasExecutivos
                semSourcing={alertas.semSourcing}
                semFecharHaMuitoTempo={alertas.semFecharHaMuitoTempo}
              />
            </Secao>
          )}
          <Secao title="Minhas tarefas">
            <TarefasWidget tarefas={tarefas} />
          </Secao>
        </TabsContent>
      )}

      {comercial && (
        <TabsContent value="comercial" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Pipeline em aberto"
              value={currency.format(comercial.kpis.valorEmAberto)}
              hint={`${comercial.kpis.oportunidadesAbertas} oportunidades`}
              icon={TrendingUp}
            />
            <KpiCard
              label="Ganho no mês"
              value={currency.format(comercial.kpis.valorGanhoNoMes)}
              hint={`${comercial.kpis.ganhasNoMes} oportunidades`}
              icon={Target}
            />
            <KpiCard
              label="Taxa de conversão"
              value={percent(comercial.kpis.taxaConversao)}
              hint="Ganho / (Ganho + Perdido)"
              icon={Percent}
            />
            <KpiCard label="Ticket médio" value={currency.format(comercial.kpis.ticketMedio)} icon={TrendingUp} />
          </div>

          <Secao title="Forecast — mês atual">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <KpiCard label="Receita ponderada (aberto)" value={currency.format(comercial.forecast.receitaPonderada)} />
              <KpiCard label="Confirmada" value={currency.format(comercial.forecast.confirmadaNoMes)} />
              <KpiCard label="Perdida" value={currency.format(comercial.forecast.perdidaNoMes)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Receita ponderada = soma do valor estimado das oportunidades em aberto × probabilidade da etapa atual.
            </p>
          </Secao>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Secao title="Funil comercial">
              <BarList
                items={comercial.funil.map((e) => ({ id: e.id, label: e.nome, value: e.valor, color: e.cor }))}
                formatValue={(v) => currency.format(v)}
              />
            </Secao>
            <Secao title="Receita mensal (Ganho)">
              <RevenueLineChart data={comercial.receitaMensal} />
            </Secao>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Secao title="Top clientes">
              <BarList
                items={comercial.topEmpresas.map((e) => ({ id: e.id, label: e.nome, value: e.valor }))}
                formatValue={(v) => currency.format(v)}
              />
            </Secao>
            <Secao title="Top consultores">
              <BarList
                items={comercial.topConsultores.map((c) => ({ id: c.id, label: c.nome, value: c.valor }))}
                formatValue={(v) => currency.format(v)}
              />
            </Secao>
          </div>
        </TabsContent>
      )}

      {recrutamento && (
        <TabsContent value="recrutamento" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Vagas abertas" value={String(recrutamento.kpis.vagasAbertas)} icon={Briefcase} />
            <KpiCard label="Fechadas no mês" value={String(recrutamento.kpis.fechadasNoMes)} icon={Target} />
            <KpiCard
              label="Taxa de conversão"
              value={percent(recrutamento.kpis.taxaConversao)}
              hint="Fechada / (Fechada + Perdida)"
              icon={Percent}
            />
            <KpiCard
              label="Tempo médio de fechamento"
              value={
                recrutamento.kpis.tempoMedioFechamentoDias !== null
                  ? `${recrutamento.kpis.tempoMedioFechamentoDias.toFixed(0)} dias`
                  : "—"
              }
              icon={Clock}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Secao title="Funil de vagas">
              <BarList items={recrutamento.funilVagas.map((e) => ({ id: e.id, label: e.nome, value: e.total, color: e.cor }))} />
            </Secao>
            <Secao title="Funil de candidatos">
              <BarList
                items={recrutamento.funilCandidatos.map((e) => ({
                  id: e.etapa,
                  label: etapaVagaCandidatoLabel[e.etapa as keyof typeof etapaVagaCandidatoLabel],
                  value: e.total,
                  color: etapaVagaCandidatoCor[e.etapa as keyof typeof etapaVagaCandidatoCor],
                }))}
              />
            </Secao>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Secao title="Top tecnologias (vagas em aberto)">
              <BarList
                items={recrutamento.topTecnologias.map((t) => ({ id: t.tecnologia, label: t.tecnologia, value: t.total }))}
              />
            </Secao>
            <Secao title="Top recrutadores (vagas fechadas)">
              <BarList items={recrutamento.topRecrutadores.map((r) => ({ id: r.id, label: r.nome, value: r.total }))} />
            </Secao>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
