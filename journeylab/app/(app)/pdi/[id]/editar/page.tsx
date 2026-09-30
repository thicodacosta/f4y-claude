import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { COM_ACOES, cobrePdi, filtroPdis } from "@/lib/pdi/regras";
import { formDoPdi, pessoaParaForm, SELECAO_PESSOA } from "@/lib/pdi/formulario";
import { AssistentePdi } from "@/components/pdi/assistente";

export const metadata: Metadata = { title: "Editar PDI" };

export default async function EditarPdiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("pdi");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.pdi.findFirst({ where: { AND: [{ id }, filtroPdis(ctx, escopo)] }, include: { ...COM_ACOES, colaborador: { select: { ...SELECAO_PESSOA, gestorId: true } } } });
  if (!p) notFound();
  if (ctx.suporte || !cobrePdi(ctx, pode(ctx, "pdi", "editar"), p.colaborador)) redirect(`/pdi/${id}`);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href={`/pdi/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {p.titulo}
        </Link>
        <h2 id="titulo" className="font-heading text-lg font-bold">
          Editar PDI · {p.colaborador.nome}
        </h2>
        <p className="text-sm text-muted-foreground">Status e progresso das ações são atualizados no detalhe do plano.</p>
      </div>
      <AssistentePdi pessoas={[pessoaParaForm(p.colaborador)]} inicial={formDoPdi(p)} fixarPessoa />
    </section>
  );
}
