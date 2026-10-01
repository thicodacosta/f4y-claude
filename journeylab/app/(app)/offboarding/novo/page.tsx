import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto } from "@/lib/datas";
import { uuidOuNada } from "@/lib/validacao";
import { CabecalhoCartao, Cartao } from "@/components/app/painel";
import { FormDesligamento } from "@/components/offboarding/form-desligamento";

export const metadata: Metadata = { title: "Registrar desligamento" };

/** Pessoas ativas ou já desligadas no cadastro sem registro de desligamento. */
export default async function NovoDesligamentoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, db } = await exigirModulo("offboarding");
  if (!pode(ctx, "offboarding", "criar") || ctx.suporte) redirect("/offboarding");
  const sp = await searchParams;
  const pessoas = await db.colaborador.findMany({
    where: { OR: [{ status: "ativo" }, { status: "desligado", desligamentos: { none: {} } }] },
    select: { id: true, nome: true, cargo: true, status: true, desligadoEm: true, equipe: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });
  return (
    <Cartao>
      <CabecalhoCartao titulo="Registrar desligamento" descricao="A pessoa passa a constar como desligada no cadastro. Cargo, equipe, área, gestor e admissão ficam registrados como estavam na saída." />
      <div className="px-5 pb-5">
        <FormDesligamento
          hoje={hojeTexto()}
          colaboradorInicial={uuidOuNada(sp.colaborador)}
          pessoas={pessoas.map((p) => ({
            id: p.id,
            nome: p.nome,
            detalhe: p.status === "desligado" ? "desligada no cadastro, sem registro" : [p.cargo, p.equipe?.nome].filter(Boolean).join(" · ") || "ativa",
            data: p.status === "desligado" && p.desligadoEm ? p.desligadoEm.toISOString().slice(0, 10) : undefined,
          }))}
        />
      </div>
    </Cartao>
  );
}
