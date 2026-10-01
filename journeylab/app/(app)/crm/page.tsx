import Link from "next/link";
import type { Metadata } from "next";
import { Download, KanbanSquare, List, Plus } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroCandidatos, filtroLista } from "@/lib/crm/consultas";
import { STATUS_CANDIDATURA } from "@/lib/crm/normalizar";
import { formatarData } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { BarraBusca, EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo, Iniciais } from "@/components/app/lista";
import { buttonVariants } from "@/components/ui/button";
import { KanbanCandidaturas } from "@/components/crm/kanban";
import { cn } from "@/lib/utils";
import { TelefoneWhatsapp } from "@/components/crm/whatsapp";

export const metadata: Metadata = { title: "Candidatos" };

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("crm");
  const sp = await searchParams;
  const kanban = sp.visao === "kanban";
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
  // Kanban: candidaturas (candidato × vaga) por etapa. Sem vaga escolhida, mostra as vagas não encerradas.
  const vagaKanban = sp.vaga && /^[0-9a-f-]{36}$/.test(sp.vaga) ? sp.vaga : undefined;
  const candidaturas = kanban
    ? await db.candidatura.findMany({
        where: {
          AND: [
            { candidato: { AND: [filtroCandidatos(ctx, escopo), filtroLista({ ...sp, vaga: undefined, status: undefined })] } },
            vagaKanban ? { vagaId: vagaKanban } : { vaga: { status: { in: ["aberta", "pausada"] } } },
          ],
        },
        include: { candidato: { select: { id: true, nome: true, cidade: true, uf: true, telefone: true } }, vaga: { select: { titulo: true } } },
        orderBy: { atualizadoEm: "desc" },
        take: 400,
      })
    : [];
  const visao = (v: "lista" | "kanban") => {
    const u = new URLSearchParams(Object.entries({ ...filtros, visao: v === "kanban" ? "kanban" : undefined }).filter((e): e is [string, string] => !!e[1]));
    return `/crm${u.size ? `?${u}` : ""}`;
  };
  const exportar = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Visualização" className="flex w-max gap-1 rounded-md border border-border bg-card p-1 shadow-surface">
          {(
            [
              ["lista", "Lista", List],
              ["kanban", "Kanban", KanbanSquare],
            ] as const
          ).map(([v, r, Icone]) => (
            <Link
              key={v}
              href={visao(v)}
              aria-current={(v === "kanban") === kanban ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-sm px-3.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                (v === "kanban") === kanban && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <Icone className="size-4" aria-hidden /> {r}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>
      <BarraBusca q={sp.q} placeholder="Nome, e-mail, cidade ou competência exata">
        {kanban && <input type="hidden" name="visao" value="kanban" />}
        <FiltroSelect nome="tag" rotulo="Tag" valor={sp.tag} opcoes={tags.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
        <FiltroSelect nome="vaga" rotulo="Vaga" valor={sp.vaga} opcoes={vagas.map((v) => ({ valor: v.id, rotulo: v.titulo }))} />
        {!kanban && <FiltroSelect
          nome="status"
          rotulo="Situação na vaga"
          valor={sp.status}
          opcoes={Object.entries(STATUS_CANDIDATURA).map(([valor, s]) => ({ valor, rotulo: s.nome }))}
        />}
        <div className="flex flex-col gap-1">
          <label htmlFor="f-uf" className="text-xs font-semibold text-muted-foreground">UF</label>
          <input id="f-uf" name="uf" maxLength={2} defaultValue={sp.uf} className="h-10 w-16 rounded-lg border border-input bg-card px-3 text-sm uppercase" />
        </div>
      </BarraBusca>
      {kanban ? (
        candidaturas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma candidatura para exibir"
            descricao="O Kanban mostra candidatos associados a vagas (abertas ou pausadas, ou a vaga escolhida no filtro). Associe candidatos a uma vaga na ficha do candidato ou receba candidaturas pela Página de Carreiras."
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {candidaturas.length} candidatura(s){vagaKanban ? "" : " em vagas abertas ou pausadas"}. {pode(ctx, "crm", "editar") && !ctx.suporte ? "Arraste os cartões ou escolha a etapa no cartão." : ""}
            </p>
            <KanbanCandidaturas
              podeMover={!!pode(ctx, "crm", "editar") && !ctx.suporte}
              mostrarVaga={!vagaKanban}
              cartoes={candidaturas.map((c) => ({
                id: c.id,
                status: c.status,
                candidatoId: c.candidato.id,
                nome: c.candidato.nome,
                vaga: c.vaga.titulo,
                local: [c.candidato.cidade, c.candidato.uf].filter(Boolean).join("/") || null,
                telefone: c.candidato.telefone,
                origemCarreiras: c.origem === "carreiras",
                atualizado: `Atualizado ${formatarData(c.atualizadoEm)}`,
              }))}
            />
          </>
        )
      ) : candidatos.length === 0 ? (
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
                    {c.telefone && <TelefoneWhatsapp telefone={c.telefone} nome={c.nome} className="text-xs" />}
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
      {!kanban && <Paginacao pagina={pagina} total={total} params={filtros} />}
    </>
  );
}
