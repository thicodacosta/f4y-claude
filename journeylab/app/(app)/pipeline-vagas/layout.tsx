import { SquareKanban } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

/** Pipeline de Vagas: parte do CRM de Candidatos (mesmo módulo e mesmas permissões). */
export default async function LayoutPipeline({ children }: { children: React.ReactNode }) {
  await exigirModulo("crm");
  return (
    <>
      <CabecalhoModulo titulo="Pipeline de Vagas" icone={SquareKanban} descricao="Vagas por etapa do processo seletivo · candidatos de cada vaga no CRM" />
      {children}
    </>
  );
}
