import { HeartHandshake } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { Abas, type Aba } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

/**
 * Retenção: RH/Admin veem o painel da organização (turnover, motivos, custos);
 * gestores veem risco e ações só dos liderados diretos.
 */
export default async function LayoutRetencao({ children }: { children: React.ReactNode }) {
  const { escopo } = await exigirModulo("retencao");
  const abas: Aba[] = [];
  if (escopo === "todos") abas.push({ href: "/retencao", rotulo: "Painel", exato: true });
  abas.push({ href: "/retencao/risco", rotulo: "Risco de saída" }, { href: "/retencao/acoes", rotulo: "Ações de retenção" });
  return (
    <>
      <CabecalhoModulo titulo="Retenção" icone={HeartHandshake} descricao={escopo === "todos" ? "Turnover, motivos reais de saída, risco e ações para reter talentos" : "Risco de saída e ações para a sua equipe"}>
        <Abas rotulo="Retenção" abas={abas} />
      </CabecalhoModulo>
      {children}
    </>
  );
}
