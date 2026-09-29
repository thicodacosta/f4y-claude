import { MessagesSquare } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { Abas, type Aba } from "@/components/app/abas";
import { CabecalhoModulo } from "@/components/app/painel";

export default async function LayoutFeedback({ children }: { children: React.ReactNode }) {
  const { ctx } = await exigirModulo("feedback");
  const abas: Aba[] = [
    { href: "/feedback", rotulo: "Reuniões", exato: true },
    { href: "/feedback/compromissos", rotulo: "Compromissos" },
  ];
  if (pode(ctx, "feedback", "administrar") === "todos") abas.push({ href: "/feedback/modelos", rotulo: "Modelos de pauta" });
  return (
    <>
      <CabecalhoModulo titulo="Feedback 1:1" icone={MessagesSquare} descricao="Conversas individuais, acordos e compromissos">
        <Abas rotulo="Feedback 1:1" abas={abas} />
      </CabecalhoModulo>
      {children}
    </>
  );
}
