import { Target } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

export default async function LayoutPdi({ children }: { children: React.ReactNode }) {
  await exigirModulo("pdi");
  return (
    <>
      <CabecalhoModulo titulo="PDI" icone={Target} descricao="Planos individuais de desenvolvimento" />
      {children}
    </>
  );
}
