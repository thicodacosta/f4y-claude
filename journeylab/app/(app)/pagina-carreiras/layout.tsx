import { Globe } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

/** Página de Carreiras: parte do CRM de Candidatos (mesmo módulo e mesmas permissões). */
export default async function LayoutCarreiras({ children }: { children: React.ReactNode }) {
  await exigirModulo("crm");
  return (
    <>
      <CabecalhoModulo titulo="Página de Carreiras" icone={Globe} descricao="Vagas publicadas no site de carreiras da empresa · candidaturas entram no CRM" />
      {children}
    </>
  );
}
