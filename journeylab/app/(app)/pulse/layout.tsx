import { Activity } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

/**
 * Pulse: RH/Admin gerenciam; gestor lê os resultados da empresa; colaborador
 * não acessa o módulo — responde pelo link pessoal (/pesquisa/responder/:id).
 */
export default async function LayoutPulse({ children }: { children: React.ReactNode }) {
  await exigirModulo("pulse");
  return (
    <>
      <CabecalhoModulo titulo="Pulse" icone={Activity} descricao="Pesquisas de clima, eNPS e pulso com resultados agregados" />
      {children}
    </>
  );
}
