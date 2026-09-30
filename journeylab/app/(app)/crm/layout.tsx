import { exigirModulo } from "@/lib/contexto";
import { Users } from "lucide-react";
import { Abas } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

export default async function LayoutCrm({ children }: { children: React.ReactNode }) {
  // Bloqueio no servidor: módulo contratado + permissão de visualizar.
  await exigirModulo("crm");
  return (
    <>
      <CabecalhoModulo titulo="CRM de Candidatos" icone={Users} descricao="Candidatos e histórico de relacionamento · vagas na Página de Carreiras">
        <Abas
          rotulo="CRM"
          abas={[
            { href: "/crm", rotulo: "Candidatos", exato: true },
          ]}
        />
      </CabecalhoModulo>
      {children}
    </>
  );
}
