import { ShieldCheck } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

/**
 * Diagnóstico NR-1 (interno): RH/Admin administram; gestores, se a empresa
 * conceder, veem agregados das áreas que lideram. Colaborador não acessa —
 * responde pela página pública do convite (/nr1/responder/:token).
 */
export default async function LayoutNr1({ children }: { children: React.ReactNode }) {
  await exigirModulo("nr1");
  return (
    <>
      <CabecalhoModulo titulo="Diagnóstico NR-1" icone={ShieldCheck} descricao="Fatores de risco psicossociais relacionados ao trabalho · resultados agregados e plano de ação" />
      {children}
    </>
  );
}
