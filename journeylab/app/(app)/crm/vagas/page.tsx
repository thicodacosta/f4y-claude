import Link from "next/link";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroVagas } from "@/lib/crm/consultas";
import { STATUS_VAGA } from "@/lib/crm/normalizar";
import { valorPermitido } from "@/lib/validacao";
import { formatarData } from "@/lib/formato";
import { FormVaga } from "@/components/crm/form-vaga";
import { Celula, Tabela } from "@/components/app/tabela";
import { BarraBusca, EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";

export const metadata: Metadata = { title: "Vagas" };

export default async function VagasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("crm");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const status = valorPermitido(sp.status, STATUS_VAGA);
  const where = {
    AND: [
      filtroVagas(ctx, escopo),
      status ? { status } : {},
      sp.q ? { titulo: { contains: sp.q, mode: "insensitive" as const } } : {},
    ],
  };
  const [total, vagas, equipes, gestores] = await Promise.all([
    db.vaga.count({ where }),
    db.vaga.findMany({
      where,
      include: { equipe: { select: { nome: true } }, gestor: { select: { nome: true } }, _count: { select: { candidaturas: true } } },
      orderBy: [{ status: "asc" }, { abertaEm: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <BarraBusca q={sp.q} placeholder="Título da vaga">
        <FiltroSelect nome="status" rotulo="Situação" valor={sp.status} opcoes={Object.entries(STATUS_VAGA).map(([valor, s]) => ({ valor, rotulo: s.nome }))} />
      </BarraBusca>
      {vagas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma vaga" descricao="Cadastre as vagas da organização para associar candidatos." />
      ) : (
        <Tabela colunas={["Vaga", "Equipe", "Gestor", "Candidatos", "Aberta em", "Situação"]} minWidth={820}>
          {vagas.map((v) => (
            <tr key={v.id}>
              <Celula>
                <Link href={`/crm/vagas/${v.id}`} className="font-medium hover:text-teal-strong">{v.titulo}</Link>
                {v.local && <span className="block text-xs text-muted-foreground">{[v.local, v.modelo].filter(Boolean).join(" · ")}</span>}
              </Celula>
              <Celula className="text-muted-foreground">{v.equipe?.nome ?? "—"}</Celula>
              <Celula className="text-muted-foreground">{v.gestor?.nome ?? "—"}</Celula>
              <Celula className="tabular-nums">{v._count.candidaturas}</Celula>
              <Celula className="tabular-nums text-muted-foreground">{formatarData(v.abertaEm)}</Celula>
              <Celula><Selo tom={STATUS_VAGA[v.status].tom}>{STATUS_VAGA[v.status].nome}</Selo></Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q, status: sp.status }} />
      {pode(ctx, "crm", "criar") && (
        <details className="rounded-lg border border-border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Nova vaga</summary>
          <div className="mt-4">
            <FormVaga equipes={equipes} gestores={gestores} />
          </div>
        </details>
      )}
    </>
  );
}
