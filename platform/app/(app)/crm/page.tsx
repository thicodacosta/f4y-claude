import Link from "next/link";
import { GitPullRequest, Briefcase, TrendingUp, Target, Percent } from "lucide-react";
import { getKpisComercial, getFunilComercial } from "@/modules/dashboard/queries";
import { getClientesAtivos, getContatos } from "@/modules/crm/queries";
import { serializeContato } from "@/modules/crm/serialize";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarList } from "@/components/dashboard/bar-list";
import { ContatosView } from "@/components/crm/contatos-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (n: number) => `${n.toFixed(0)}%`;

export default async function CrmPage() {
  const [kpis, funil, clientes, contatos] = await Promise.all([
    getKpisComercial(),
    getFunilComercial(),
    getClientesAtivos(),
    getContatos(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">CRM</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do CRM — pipeline comercial, clientes e contatos.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/empresas">
            <Button variant="outline">
              <Briefcase />
              Empresas
            </Button>
          </Link>
          <Link href="/crm/pipeline-comercial">
            <Button>
              <GitPullRequest />
              Pipeline Comercial
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Pipeline em aberto"
          value={currency.format(kpis.valorEmAberto)}
          hint={`${kpis.oportunidadesAbertas} oportunidade(s)`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Ganho no mês"
          value={currency.format(kpis.valorGanhoNoMes)}
          hint={`${kpis.ganhasNoMes} oportunidade(s)`}
          icon={Target}
        />
        <KpiCard label="Taxa de conversão" value={percent(kpis.taxaConversao)} hint="Ganho / (Ganho + Perdido)" icon={Percent} />
        <KpiCard label="Ticket médio" value={currency.format(kpis.ticketMedio)} icon={TrendingUp} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Funil comercial</h2>
        <BarList
          items={funil.map((e) => ({ id: e.id, label: e.nome, value: e.valor, color: e.cor }))}
          formatValue={(v) => currency.format(v)}
          emptyLabel="Nenhuma oportunidade cadastrada ainda."
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Contatos ({contatos.length})</h2>
        <ContatosView contatos={contatos.map(serializeContato)} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold">Clientes ({clientes.length})</h2>
          <Link href="/empresas" className="text-xs text-primary underline underline-offset-2">
            Ver todas as empresas →
          </Link>
        </div>
        {clientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente ativo ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/empresas/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm hover:bg-muted"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.segmento ?? "—"}
                    {c.cidade ? ` · ${c.cidade}${c.estado ? "/" + c.estado : ""}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c._count.contatos} contato(s)</span>
                  <span>{c._count.oportunidades} oportunidade(s)</span>
                  <span>{c._count.vagas} vaga(s)</span>
                  <Badge>Ativo</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
