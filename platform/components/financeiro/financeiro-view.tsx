"use client";

import { Wallet, Receipt, CircleDollarSign, BadgeCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FaturamentoTable } from "@/components/financeiro/faturamento-table";
import { ComissoesTable } from "@/components/financeiro/comissoes-table";
import { RegrasComissaoEditor } from "@/components/financeiro/regras-comissao-editor";
import type { VerticalNegocio } from "@/lib/generated/prisma/client";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Kpis = {
  faturamentoPendente: number;
  faturamentoPendenteCount: number;
  faturadoNoMes: number;
  pagoNoMes: number;
  comissoesPendentes: number;
  comissoesPendentesCount: number;
  comissoesAprovadas: number;
  comissoesAprovadasCount: number;
};

type Faturamento = {
  id: string;
  empresaNome: string;
  origem: string;
  valor: number;
  status: string;
  dataPrevista: string | null;
  dataEfetiva: string | null;
};

type Comissao = {
  id: string;
  usuarioNome: string;
  origem: string;
  valor: number;
  percentual: number;
  status: string;
  competencia: string;
};

type Regra = { id: string; vertical: VerticalNegocio; percentualConsultor: number; percentualRecrutador: number };

export function FinanceiroView({
  kpis,
  faturamentos,
  comissoes,
  regras,
  ehAdmin,
}: {
  kpis: Kpis;
  faturamentos: Faturamento[];
  comissoes: Comissao[];
  regras: Regra[];
  ehAdmin: boolean;
}) {
  return (
    <Tabs defaultValue="geral" className="flex flex-1 flex-col gap-4">
      <TabsList>
        <TabsTrigger value="geral">Visão geral</TabsTrigger>
        <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
        <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        {ehAdmin && <TabsTrigger value="regras">Regras</TabsTrigger>}
      </TabsList>

      <TabsContent value="geral" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Faturamento pendente"
            value={currency.format(kpis.faturamentoPendente)}
            hint={`${kpis.faturamentoPendenteCount} lançamentos`}
            icon={Receipt}
          />
          <KpiCard label="Faturado no mês" value={currency.format(kpis.faturadoNoMes)} icon={Wallet} />
          <KpiCard label="Pago no mês" value={currency.format(kpis.pagoNoMes)} icon={CircleDollarSign} />
          <KpiCard
            label="Comissões pendentes"
            value={currency.format(kpis.comissoesPendentes)}
            hint={`${kpis.comissoesPendentesCount} lançamentos`}
            icon={BadgeCheck}
          />
        </div>
      </TabsContent>

      <TabsContent value="faturamento">
        <FaturamentoTable faturamentos={faturamentos} />
      </TabsContent>

      <TabsContent value="comissoes">
        <ComissoesTable comissoes={comissoes} />
      </TabsContent>

      {ehAdmin && (
        <TabsContent value="regras">
          <RegrasComissaoEditor regras={regras} />
        </TabsContent>
      )}
    </Tabs>
  );
}
