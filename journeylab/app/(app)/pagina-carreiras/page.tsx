import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Plus } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroVagas } from "@/lib/crm/consultas";
import { formatarData } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import { caminhoCarreiras, caminhoVagaPublica, nomeContratacao, nomeModalidade, situacaoPublica } from "@/lib/carreiras/regras";
import { EstadoVazio, FiltroSelect, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { CopiarLink } from "@/components/carreiras/acoes";

export const metadata: Metadata = { title: "Página de Carreiras" };

const FILTROS = { publicadas: "Publicadas", nao_publicadas: "Não publicadas", encerradas: "Encerradas" } as const;

export default async function CarreirasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("crm");
  const sp = await searchParams;
  const filtro = valorPermitido(sp.situacao, FILTROS);
  const podeCriar = !!pode(ctx, "crm", "criar") && !ctx.suporte;
  const where = {
    AND: [
      filtroVagas(ctx, escopo),
      filtro === "publicadas"
        ? { publicada: true, status: { in: ["aberta" as const, "pausada" as const] } }
        : filtro === "nao_publicadas"
          ? { publicada: false, status: { in: ["aberta" as const, "pausada" as const] } }
          : filtro === "encerradas"
            ? { status: { in: ["fechada" as const, "cancelada" as const] } }
            : {},
    ],
  };
  const vagas = await db.vaga.findMany({
    where,
    include: {
      _count: { select: { candidaturas: true } },
      candidaturas: { where: { notificacaoStatus: "falhou" }, select: { id: true } },
    },
    orderBy: [{ publicada: "desc" }, { abertaEm: "desc" }],
    take: 200,
  });
  const slug = (await db.organizacao.findUnique({ where: { id: ctx.org.id }, select: { slug: true } }))?.slug ?? "";
  const publicadas = vagas.filter((v) => situacaoPublica(v).chave === "publicada").length;

  return (
    <>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">Página pública da empresa</p>
          <p className="truncate font-heading font-bold">{caminhoCarreiras(slug)}</p>
          <p className="text-xs text-muted-foreground">{publicadas} vaga(s) publicada(s). Candidaturas não exigem conta e entram automaticamente no CRM de Candidatos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopiarLink caminho={caminhoCarreiras(slug)} rotulo="Copiar link da página" />
          <a href={caminhoCarreiras(slug)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
            <ExternalLink className="size-4" aria-hidden /> Abrir
          </a>
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2">
          <FiltroSelect nome="situacao" rotulo="Situação" valor={filtro} opcoes={Object.entries(FILTROS).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          <button type="submit" className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            Filtrar
          </button>
        </form>
        {podeCriar && (
          <Link href="/pagina-carreiras/nova" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" aria-hidden /> Nova vaga
          </Link>
        )}
      </div>

      {vagas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma vaga" descricao={podeCriar ? "Crie uma vaga, confira o e-mail de aviso e publique na página de carreiras." : "Não há vagas no seu escopo."} />
      ) : (
        <Tabela colunas={["Vaga", "Situação", "Candidaturas", "Criada por", "Links"]} minWidth={860}>
          {vagas.map((v) => {
            const s = situacaoPublica(v);
            return (
              <tr key={v.id}>
                <Celula>
                  <Link href={`/pagina-carreiras/vagas/${v.id}`} className="font-medium hover:text-teal-strong">
                    {v.titulo}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{[v.local, nomeModalidade(v.modelo), nomeContratacao(v.tipoContratacao)].filter(Boolean).join(" · ") || "—"}</span>
                </Celula>
                <Celula>
                  <Selo tom={s.tom}>{s.nome}</Selo>
                  {v.candidaturas.length > 0 && <span className="mt-1 block text-xs font-medium text-destructive">{v.candidaturas.length} aviso(s) com falha</span>}
                </Celula>
                <Celula className="tabular-nums">{v._count.candidaturas}</Celula>
                <Celula className="text-xs text-muted-foreground">
                  {v.criadoPor}
                  <span className="block">{formatarData(v.abertaEm)}</span>
                </Celula>
                <Celula>{s.chave === "publicada" ? <CopiarLink caminho={caminhoVagaPublica(slug, v.slug)} rotulo="Link da vaga" /> : <span className="text-xs text-muted-foreground">—</span>}</Celula>
              </tr>
            );
          })}
        </Tabela>
      )}
    </>
  );
}
