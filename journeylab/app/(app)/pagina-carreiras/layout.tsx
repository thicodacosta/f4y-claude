import { Globe } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { Abas, type Aba } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

/** Página de Carreiras: parte do CRM de Candidatos (mesmo módulo e mesmas permissões). */
export default async function LayoutCarreiras({ children }: { children: React.ReactNode }) {
  const { ctx } = await exigirModulo("crm");
  const abas: Aba[] = [{ href: "/pagina-carreiras", rotulo: "Vagas", exato: true }];
  if (pode(ctx, "crm", "editar") === "todos") abas.push({ href: "/pagina-carreiras/configuracoes", rotulo: "Configurações da página" });
  return (
    <>
      <CabecalhoModulo titulo="Página de Carreiras" icone={Globe} descricao="Vagas publicadas no site de carreiras da empresa · candidaturas entram no CRM">
        {abas.length > 1 && <Abas rotulo="Página de Carreiras" abas={abas} />}
      </CabecalhoModulo>
      {children}
    </>
  );
}
