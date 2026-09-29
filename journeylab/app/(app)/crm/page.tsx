import Link from "next/link";
import type { Metadata } from "next";
import { Download, Plus } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroCandidatos, filtroLista } from "@/lib/crm/consultas";
import { STATUS_CANDIDATURA } from "@/lib/crm/normalizar";
import { formatarData } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { BarraBusca, EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo, Iniciais } from "@/components/app/lista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Candidatos" };

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("crm");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const where = { AND: [filtroCandidatos(ctx, escopo), filtroLista(sp)] };
  const [total, candidatos, tags, vagas] = await Promise.all([
    db.candidato.count({ where }),
    db.candidato.findMany({
      where,
      include: {
        tags: { include: { tag: { select: { nome: true } } } },
        candidaturas: { include: { vaga: { select: { titulo: true } } }, orderBy: { atualizadoEm: "desc" }, take: 2 },
        colaborador: { select: { id: true } },
      },
      orderBy: { atualizadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.tag.findMany({ orderBy: { nome: "asc" } }),
    db.vaga.findMany({ select: { id: true, titulo: true }, orderBy: { abertaEm: "desc" } }),
  ]);
  const filtros = { q: sp.q, tag: sp.tag, vaga: sp.vaga, status: sp.status, uf: sp.uf };
  const exportar = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pode(ctx, "crm", "exportar") && (
          <a href={`/crm/exportar?${exportar}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
            <Download data-icon="inline-start" /> Exportar CSV
          </a>
        )}
        {pode(ctx, "crm", "criar") && (
          <Link href="/crm/candidatos/novo" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
            <Plus data-icon="inline-start" /> Novo candidato
          </Link>
        )}
      </div>
      <BarraBusca q={sp.q} placeholder="Nome, e-mail, cidade ou competência exata">
        <FiltroSelect nome="tag" rotulo="Tag" valor={sp.tag} opcoes={tags.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
        <FiltroSelect nome="vaga" rotulo="Vaga" valor={sp.vaga} opcoes={vagas.map((v) => ({ valor: v.id, rotulo: v.titulo }))} />
        <FiltroSelect
          nome="status"
          rotulo="Situação na vaga"
          valor={sp.status}
          opcoes={Object.entries(STATUS_CANDIDATURA).map(([valor, s]) => ({ valor, rotulo: s.nome }))}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="f-uf" className="text-xs font-semibold text-muted-foreground">UF</label>
          <input id="f-uf" name="uf" maxLength={2} defaultValue={sp.uf} className="h-10 w-16 rounded-lg border border-input bg-card px-3 text-sm uppercase" />
        </div>
      </BarraBusca>
      {candidatos.length === 0 ? (
        <EstadoVazio
          titulo={Object.values(filtros).some(Boolean) ? "Nenhum candidato com esses filtros" : "Nenhum candidato cadastrado"}
          descricao={
            escopo === "todos"
              ? "Cadastre candidatos manualmente e associe-os às vagas da organização."
              : "Você vê apenas candidatos das vagas em que é gestor responsável."
          }
        />
      ) : (
        <Tabela colunas={["Candidato", "Localização", "Vagas", "Tags", "Atualizado"]} minWidth={860}>
          {candidatos.map((c) => (
            <tr key={c.id}>
              <Celula>
                <span className="flex items-center gap-3">
                  <Iniciais nome={c.nome} />
                  <span className="min-w-0">
                    <Link href={`/crm/candidatos/${c.id}`} className="font-medium hover:text-teal-strong">{c.nome}</Link>
                    {c.email && <span className="block text-xs text-muted-foreground">{c.email}</span>}
                    {c.colaborador && <span className="mt-1 block"><Selo tom="sucesso">Colaborador</Selo></span>}
                  </span>
                </span>
              </Celula>
              <Celula className="text-muted-foreground">{[c.cidade, c.uf].filter(Boolean).join("/") || "—"}</Celula>
              <Celula>
                {c.candidaturas.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {c.candidaturas.map((cd) => (
                      <li key={cd.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-foreground/85">{cd.vaga.titulo}</span>
                        <Selo tom={STATUS_CANDIDATURA[cd.status].tom}>{STATUS_CANDIDATURA[cd.status].nome}</Selo>
                      </li>
                    ))}
                  </ul>
                )}
              </Celula>
              <Celula>
                <span className="flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <span key={t.tagId} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t.tag.nome}</span>
                  ))}
                </span>
              </Celula>
              <Celula className="tabular-nums text-muted-foreground">{formatarData(c.atualizadoEm)}</Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={filtros} />
    </>
  );
}
