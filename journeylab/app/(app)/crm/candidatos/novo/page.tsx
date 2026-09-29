import Link from "next/link";
import type { Metadata } from "next";
import { exigirModulo } from "@/lib/contexto";
import { FormCandidato } from "@/components/crm/form-candidato";

export const metadata: Metadata = { title: "Novo candidato" };

export default async function NovoCandidatoPage() {
  await exigirModulo("crm", "criar");
  return (
    <>
      <div>
        <Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground">← Candidatos</Link>
        <h2 className="mt-2 font-heading text-xl font-bold">Novo candidato</h2>
        <p className="text-sm text-muted-foreground">O sistema verifica possíveis duplicidades por e-mail, telefone, LinkedIn e nome.</p>
      </div>
      <FormCandidato />
    </>
  );
}
