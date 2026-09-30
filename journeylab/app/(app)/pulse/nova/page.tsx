import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto } from "@/lib/datas";
import { dadosAssistente } from "@/lib/pulse/consultas";
import { Assistente } from "@/components/pulse/assistente";

export const metadata: Metadata = { title: "Nova pesquisa · Pulse" };

export default async function NovaPesquisaPage() {
  const { ctx } = await exigirModulo("pulse");
  if (pode(ctx, "pulse", "criar") !== "todos" || ctx.suporte) redirect("/pulse");
  const dados = await dadosAssistente(ctx);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <h2 id="titulo" className="font-heading text-lg font-bold">
        Nova pesquisa
      </h2>
      <Assistente {...dados} hoje={hojeTexto()} />
    </section>
  );
}
