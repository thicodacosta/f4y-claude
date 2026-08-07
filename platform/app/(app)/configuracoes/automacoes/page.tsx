import { requirePapel } from "@/lib/auth";
import { PAPEIS_AUTOMACOES } from "@/lib/roles";
import { getAutomacoes, getExecucoesRecentes } from "@/modules/automacoes/queries";
import { AutomacoesList } from "@/components/automacoes/automacoes-list";
import { ExecucoesLog } from "@/components/automacoes/execucoes-log";

export default async function AutomacoesPage() {
  await requirePapel(PAPEIS_AUTOMACOES);
  const [automacoes, execucoes] = await Promise.all([getAutomacoes(), getExecucoesRecentes()]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Automações</h1>
        <p className="text-sm text-muted-foreground">
          Regras da engine de automação — disparam ao mudar de etapa ou quando um SLA estoura.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Regras</h2>
        <AutomacoesList automacoes={automacoes} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Histórico de execução</h2>
        <ExecucoesLog execucoes={execucoes} />
      </div>
    </div>
  );
}
