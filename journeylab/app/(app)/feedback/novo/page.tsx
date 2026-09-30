import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto } from "@/lib/datas";
import { filtroPessoasFeedback } from "@/lib/feedback/regras";
import { FormAvaliacao } from "@/components/feedback/form-avaliacao";

export const metadata: Metadata = { title: "Novo feedback" };

export default async function NovoFeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("feedback", "criar");
  if (ctx.suporte) redirect("/feedback");
  const sp = await searchParams;
  const pessoas = await db.colaborador.findMany({ where: filtroPessoasFeedback(ctx, escopo), select: { id: true, nome: true, cargo: true }, orderBy: { nome: "asc" } });
  // ?colaborador=<id> só é aceito se a pessoa estiver no escopo do usuário.
  const pedido = sp.colaborador;
  const permitido = pedido && pessoas.some((p) => p.id === pedido) ? pedido : undefined;
  const ultimo = permitido ? await db.avaliacaoFeedback.findFirst({ where: { colaboradorId: permitido }, orderBy: { data: "desc" }, select: { periodicidade: true } }) : null;
  // Texto pré-preenchido vindo de link: tratado como texto não confiável (React escapa; tamanho limitado).
  const comentario = (sp.comentario ?? "").slice(0, 500);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/feedback" className="text-sm text-muted-foreground hover:text-foreground">← Feedback 1:1</Link>
        <h2 className="font-heading text-2xl font-bold">Novo feedback</h2>
        <p className="text-sm text-muted-foreground">Avalie os 8 critérios de Performance e os 8 de Cultura de 1 a 5. Todas as notas são obrigatórias.</p>
      </div>
      {pedido && !permitido && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          O colaborador do link não está entre as pessoas que você pode avaliar. Escolha na lista abaixo.
        </p>
      )}
      {pessoas.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          {escopo === "todos" ? "Não há pessoas ativas cadastradas." : "Você ainda não tem liderados diretos ativos no cadastro."}
        </p>
      ) : (
        <FormAvaliacao
          pessoas={pessoas}
          pdiDisponivel={ctx.modulos.has("pdi") && !!pode(ctx, "pdi", "criar")}
          inicial={{ colaboradorId: permitido, data: hojeTexto(), hoje: hojeTexto(), periodicidade: ultimo?.periodicidade ?? "mensal", observacoes: comentario }}
        />
      )}
    </>
  );
}
