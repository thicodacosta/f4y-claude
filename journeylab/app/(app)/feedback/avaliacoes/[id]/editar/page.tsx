import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto, textoDeData } from "@/lib/datas";
import { TODOS_CRITERIOS, type Notas } from "@/lib/feedback/avaliacao";
import { filtroAvaliacoes, podeEditarAvaliacao } from "@/lib/feedback/regras";
import { FormAvaliacao } from "@/components/feedback/form-avaliacao";

export const metadata: Metadata = { title: "Editar feedback" };

export default async function EditarFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("feedback", "editar");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = await db.avaliacaoFeedback.findFirst({ where: { AND: [{ id }, filtroAvaliacoes(ctx, escopo)] }, include: { colaborador: { select: { nome: true, gestorId: true } } } });
  if (!a) notFound();
  if (!podeEditarAvaliacao(ctx, escopo, a.colaborador)) redirect(`/feedback/avaliacoes/${id}`);
  const notas = Object.fromEntries(TODOS_CRITERIOS.map((c) => [c.campo, (a as unknown as Record<string, number>)[c.campo]])) as Notas;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href={`/feedback/avaliacoes/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Feedback de {a.colaborador.nome}</Link>
        <h2 className="font-heading text-2xl font-bold">Editar feedback</h2>
      </div>
      <FormAvaliacao
        pdiDisponivel={ctx.modulos.has("pdi") && !!pode(ctx, "pdi", "criar")}
        inicial={{ id: a.id, colaboradorNome: a.colaborador.nome, data: textoDeData(a.data), hoje: hojeTexto(), periodicidade: a.periodicidade, observacoes: a.observacoes ?? "", notas }}
      />
    </>
  );
}
