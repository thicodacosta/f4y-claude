import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

/**
 * Pulse: responder é permitido a quem está no público (sem permissão de
 * gestão). Aqui só exigimos o módulo ativo; cada página checa o que mostra.
 */
export default async function LayoutPulse({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  if (!ctx.modulos.has("pulse")) redirect("/inicio?bloqueado=pulse");
  const gestao = !!pode(ctx, "pulse", "visualizar");
  return (
    <>
      <CabecalhoModulo titulo="Pulse" icone={Activity} descricao={gestao ? "Pesquisas rápidas, anônimas, com resultados agregados" : "Pesquisas anônimas da sua organização"} />
      {children}
    </>
  );
}
