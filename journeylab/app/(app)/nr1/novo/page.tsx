import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto } from "@/lib/datas";
import { dadosFormularioNr1 } from "@/lib/nr1/form";
import { FormularioDiagnostico } from "@/components/nr1/formulario-diagnostico";

export const metadata: Metadata = { title: "Novo diagnóstico · NR-1" };

export default async function NovoDiagnostico() {
  const { ctx } = await exigirModulo("nr1");
  if (pode(ctx, "nr1", "criar") !== "todos" || ctx.suporte) redirect("/nr1");
  const dados = await dadosFormularioNr1(ctx);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <div>
        <Link href="/nr1" className="text-sm text-muted-foreground hover:text-foreground">
          ← Diagnóstico NR-1
        </Link>
        <h2 id="titulo" className="font-heading text-lg font-bold">
          Novo diagnóstico
        </h2>
        <p className="text-sm text-muted-foreground">Nasce como rascunho. Você revisa o questionário e a mensagem antes de ativar e enviar os convites.</p>
      </div>
      <FormularioDiagnostico {...dados} hoje={hojeTexto()} />
    </section>
  );
}
