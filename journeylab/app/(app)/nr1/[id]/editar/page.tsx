import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto, textoDeData } from "@/lib/datas";
import { dadosFormularioNr1 } from "@/lib/nr1/form";
import { FormularioDiagnostico } from "@/components/nr1/formulario-diagnostico";

export const metadata: Metadata = { title: "Editar diagnóstico · NR-1" };

export default async function EditarDiagnostico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, db } = await exigirModulo("nr1");
  if (pode(ctx, "nr1", "editar") !== "todos" || ctx.suporte) redirect(`/nr1/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await db.cicloNr1.findUnique({ where: { id }, include: { perguntas: { select: { chave: true } } } });
  if (!c) notFound();
  if (c.status !== "rascunho") redirect(`/nr1/${id}`);
  const dados = await dadosFormularioNr1(ctx);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <div>
        <Link href={`/nr1/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {c.titulo}
        </Link>
        <h2 id="titulo" className="font-heading text-lg font-bold">
          Editar rascunho
        </h2>
      </div>
      <FormularioDiagnostico
        {...dados}
        hoje={hojeTexto()}
        inicial={{
          id: c.id,
          titulo: c.titulo,
          descricao: c.descricao ?? "",
          tipo: c.tipo,
          itens: c.perguntas.map((p) => p.chave).filter((k): k is string => !!k),
          audienciaTipo: c.audienciaTipo as "todos",
          areaIds: c.areaIds,
          colaboradorIds: c.colaboradorIds,
          dataInicio: c.dataInicio ? textoDeData(c.dataInicio) : "",
          encerraEm: c.encerraEm ? textoDeData(c.encerraEm) : "",
          coletarDepartamento: c.coletarDepartamento,
          mensagemConvite: c.mensagemConvite ?? "",
          faixas: c.faixas.length === 4 ? c.faixas : [20, 40, 60, 80],
        }}
      />
    </section>
  );
}
