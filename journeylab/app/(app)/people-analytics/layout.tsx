import { ChartNoAxesCombined } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { Abas, type Aba } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

/** People Analytics: visão da organização inteira (escopo mínimo "todos" — RH/Admin). */
export default async function LayoutPeopleAnalytics({ children }: { children: React.ReactNode }) {
  const { ctx } = await exigirModulo("analytics");
  const abas: Aba[] = [{ href: "/people-analytics", rotulo: "Visão geral", exato: true }];
  abas.push({ href: "/people-analytics/referencias", rotulo: pode(ctx, "analytics", "editar") ? "Referências de mercado" : "Referências" });
  return (
    <>
      <CabecalhoModulo titulo="People Analytics" icone={ChartNoAxesCombined} descricao="Indicadores integrados da jornada · insights, projeções e comparativo de mercado">
        <Abas rotulo="People Analytics" abas={abas} />
      </CabecalhoModulo>
      {children}
    </>
  );
}
