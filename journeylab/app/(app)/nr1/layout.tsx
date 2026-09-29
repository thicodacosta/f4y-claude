import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { exigirContexto } from "@/lib/contexto";
import { CabecalhoModulo } from "@/components/app/painel";

/** NR-1: participar é permitido a quem está no público; a gestão exige permissão (checada em cada página). */
export default async function LayoutNr1({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  if (!ctx.modulos.has("nr1")) redirect("/inicio?bloqueado=nr1");
  return (
    <>
      <CabecalhoModulo titulo="Diagnóstico NR-1" icone={ShieldCheck} descricao="Fatores de risco psicossociais · resultados anônimos e agregados" />
      {children}
    </>
  );
}
