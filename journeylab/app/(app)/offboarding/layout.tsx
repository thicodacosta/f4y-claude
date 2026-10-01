import { DoorClosed } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { Abas, type Aba } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

/**
 * Offboarding: desligamentos e entrevistas de saída. Confidencial — só RH/Admin
 * (escopo mínimo "todos"); a liderança direta não vê as respostas.
 */
export default async function LayoutOffboarding({ children }: { children: React.ReactNode }) {
  const { ctx } = await exigirModulo("offboarding");
  const abas: Aba[] = [{ href: "/offboarding", rotulo: "Desligamentos", exato: true }];
  if (pode(ctx, "offboarding", "criar") && !ctx.suporte) abas.push({ href: "/offboarding/novo", rotulo: "Registrar desligamento" });
  return (
    <>
      <CabecalhoModulo titulo="Offboarding" icone={DoorClosed} descricao="Desligamentos e entrevistas de saída confidenciais · motivos reais para reduzir o turnover">
        <Abas rotulo="Offboarding" abas={abas} />
      </CabecalhoModulo>
      {children}
    </>
  );
}
