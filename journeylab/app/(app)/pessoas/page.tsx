import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { dbTenant } from "@/lib/db";
import { exigirContexto, filtroColaboradores, pode } from "@/lib/contexto";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatarData } from "@/lib/formato";
import { CabecalhoPagina } from "@/components/secao";
import { Celula, Tabela } from "@/components/app/tabela";
import { BarraBusca, EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo, Iniciais } from "@/components/app/lista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_PESSOA } from "@/lib/rotulos";
import { uuidOuNada, valorPermitido } from "@/lib/validacao";

export const metadata: Metadata = { title: "Pessoas" };


export default async function PessoasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "cadastro", "visualizar");
  if (!escopo || escopo === "proprio") redirect("/conta");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const db = dbTenant(ctx.org.id, ctx.usuario.id);

  const where: Prisma.ColaboradorWhereInput = {
    AND: [
      filtroColaboradores(ctx, escopo),
      sp.q ? { OR: [{ nome: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { cargo: { contains: sp.q, mode: "insensitive" } }] } : {},
      valorPermitido(sp.status, STATUS_PESSOA) ? { status: valorPermitido(sp.status, STATUS_PESSOA) } : {},
      uuidOuNada(sp.equipe) ? { equipeId: uuidOuNada(sp.equipe) } : {},
    ],
  };
  const [total, pessoas, equipes] = await Promise.all([
    db.colaborador.count({ where }),
    db.colaborador.findMany({
      where,
      include: { equipe: { select: { nome: true } }, gestor: { select: { nome: true } }, associacao: { select: { id: true } } },
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const podeCriar = pode(ctx, "cadastro", "criar") === "todos";

  return (
    <>
      <CabecalhoPagina
        titulo="Pessoas"
        descricao={
          escopo === "equipe"
            ? "Sua equipe. Este cadastro é usado por todos os módulos ativos."
            : "Cadastro único de colaboradores da organização, usado por Onboarding, Feedback 1:1, Pulse, PDI e NR-1."
        }
        acao={
          podeCriar && (
            <Link href="/pessoas/nova" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
              <Plus data-icon="inline-start" /> Nova pessoa
            </Link>
          )
        }
      />
      <BarraBusca q={sp.q} placeholder="Nome, e-mail ou cargo">
        <FiltroSelect nome="status" rotulo="Situação" valor={sp.status} opcoes={Object.entries(STATUS_PESSOA).map(([valor, s]) => ({ valor, rotulo: s.nome }))} />
        <FiltroSelect nome="equipe" rotulo="Equipe" valor={sp.equipe} opcoes={equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
      </BarraBusca>
      {pessoas.length === 0 ? (
        <EstadoVazio
          titulo={sp.q || sp.status || sp.equipe ? "Nenhuma pessoa com esses filtros" : "Nenhuma pessoa cadastrada"}
          descricao={podeCriar ? "Cadastre a primeira pessoa ou converta um candidato contratado no CRM." : "Não há pessoas visíveis para o seu papel."}
        />
      ) : (
        <Tabela colunas={["Nome", "Cargo", "Equipe", "Gestor", "Admissão", "Situação", "Conta"]} minWidth={900}>
          {pessoas.map((p) => (
            <tr key={p.id}>
              <Celula>
                <span className="flex items-center gap-3">
                  <Iniciais nome={p.nome} />
                  <span className="min-w-0">
                    <Link href={`/pessoas/${p.id}`} className="font-medium hover:text-teal-strong">
                      {p.nome}
                    </Link>
                    {p.email && <span className="block text-xs text-muted-foreground">{p.email}</span>}
                  </span>
                </span>
              </Celula>
              <Celula className="text-muted-foreground">{p.cargo ?? "—"}</Celula>
              <Celula className="text-muted-foreground">{p.equipe?.nome ?? "—"}</Celula>
              <Celula className="text-muted-foreground">{p.gestor?.nome ?? "—"}</Celula>
              <Celula className="tabular-nums text-muted-foreground">{p.dataAdmissao ? formatarData(p.dataAdmissao) : "—"}</Celula>
              <Celula>
                <Selo tom={STATUS_PESSOA[p.status].tom}>{STATUS_PESSOA[p.status].nome}</Selo>
              </Celula>
              <Celula className="text-muted-foreground">{p.associacao ? "Com acesso" : "—"}</Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q, status: sp.status, equipe: sp.equipe }} />
    </>
  );
}
