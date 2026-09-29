import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { Abas } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

export default async function LayoutConfiguracoes({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  if (!pode(ctx, "organizacao", "visualizar")) redirect("/inicio");
  return (
    <>
      <CabecalhoModulo titulo="Configurações" icone={Settings2} descricao={ctx.org.nome}>
        <Abas
          rotulo="Configurações"
          abas={[
            { href: "/configuracoes/usuarios", rotulo: "Usuários" },
            { href: "/configuracoes/papeis", rotulo: "Papéis e permissões" },
            { href: "/configuracoes/modulos", rotulo: "Módulos contratados" },
            { href: "/configuracoes/retencao", rotulo: "Retenção de dados" },
            { href: "/configuracoes/auditoria", rotulo: "Auditoria" },
          ]}
        />
      </CabecalhoModulo>
      {children}
    </>
  );
}
