import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto, textoDeData } from "@/lib/datas";
import { deBanco } from "@/lib/pulse/perguntas";
import { dadosAssistente } from "@/lib/pulse/consultas";
import { Assistente } from "@/components/pulse/assistente";

export const metadata: Metadata = { title: "Editar pesquisa · Pulse" };

export default async function EditarPesquisaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, db } = await exigirModulo("pulse");
  if (pode(ctx, "pulse", "editar") !== "todos" || ctx.suporte) redirect(`/pulse/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
  if (!p) notFound();
  if (p.status !== "rascunho") redirect(`/pulse/${id}`);
  const dados = await dadosAssistente(ctx);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <h2 id="titulo" className="font-heading text-lg font-bold">
        Editar rascunho · {p.titulo}
      </h2>
      <Assistente
        {...dados}
        hoje={hojeTexto()}
        inicial={{
          id: p.id,
          titulo: p.titulo,
          descricao: p.descricao ?? "",
          anonima: p.anonima,
          audienciaTipo: p.audienciaTipo as "todos",
          areaIds: p.areaIds,
          equipeIds: p.equipeIds,
          colaboradorIds: p.colaboradorIds,
          dataInicio: p.dataInicio ? textoDeData(p.dataInicio) : "",
          encerraEm: p.encerraEm ? textoDeData(p.encerraEm) : "",
          linkAberto: p.linkAberto,
          perguntas: p.perguntas.map(deBanco),
        }}
      />
    </section>
  );
}
