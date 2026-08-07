import { getSessionUsuario } from "@/lib/auth";
import { getKpisFinanceiro, getFaturamentos, getComissoes, getRegrasComissao } from "@/modules/financeiro/queries";
import { FinanceiroView } from "@/components/financeiro/financeiro-view";

export default async function FinanceiroPage() {
  const usuario = await getSessionUsuario();
  const [kpis, faturamentos, comissoes, regras] = await Promise.all([
    getKpisFinanceiro(),
    getFaturamentos(),
    getComissoes(),
    getRegrasComissao(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Faturamento e comissões gerados automaticamente ao fechar oportunidades e vagas.
        </p>
      </div>
      <FinanceiroView
        kpis={kpis}
        faturamentos={faturamentos}
        comissoes={comissoes}
        regras={regras}
        ehAdmin={usuario?.papel === "admin"}
      />
    </div>
  );
}
