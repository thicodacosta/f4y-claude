import { exigirModulo, pode } from "@/lib/contexto";
import { DoorOpen } from "lucide-react";
import { Abas } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

export default async function LayoutOnboarding({ children }: { children: React.ReactNode }) {
  const { ctx } = await exigirModulo("onboarding");
  const abas = [{ href: "/onboarding", rotulo: "Onboardings", exato: true }];
  if (pode(ctx, "onboarding", "editar") === "todos") abas.push({ href: "/onboarding/modelos", rotulo: "Modelos", exato: false });
  return (
    <>
      <CabecalhoModulo titulo="Onboarding" icone={DoorOpen} descricao="Jornadas de integração, tarefas e documentação">
        {abas.length > 1 && <Abas rotulo="Onboarding" abas={abas} />}
      </CabecalhoModulo>
      {children}
    </>
  );
}
