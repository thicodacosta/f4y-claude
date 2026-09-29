import Link from "next/link";
import type { Metadata } from "next";
import { exigirModulo, filtroColaboradores, pode } from "@/lib/contexto";
import { filtroPdis, PDI_ABERTO, progressoPdi, STATUS_PDI } from "@/lib/pdi/regras";
import { criarPdi } from "@/lib/pdi/actions";
import { valorPermitido } from "@/lib/validacao";
import { formatarData } from "@/lib/formato";
import { BarraProgresso } from "@/components/secao";
import { EstadoVazio, FiltroSelect, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao, LinkExportar } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "PDI" };

const SITUACAO = { abertos: "Rascunho ou ativo", concluido: "Concluídos", arquivado: "Arquivados" } as const;

export default async function PdiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("pdi");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const situacao = valorPermitido(sp.situacao, SITUACAO) ?? "abertos";
  const where = {
    AND: [filtroPdis(ctx, escopo), situacao === "abertos" ? { status: { in: [...PDI_ABERTO] } } : { status: situacao }],
  };
  const escopoCriar = pode(ctx, "pdi", "criar");
  const [total, pdis, pessoas] = await Promise.all([
    db.pdi.count({ where }),
    db.pdi.findMany({
      where,
      include: { colaborador: { select: { nome: true, cargo: true } }, acoes: { select: { status: true } } },
      orderBy: [{ status: "asc" }, { fim: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    escopoCriar
      ? db.colaborador.findMany({
          where: { AND: [filtroColaboradores(ctx, escopoCriar), { status: "ativo" }, { pdis: { none: { status: { in: [...PDI_ABERTO] } } } }] },
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        })
      : [],
  ]);
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  const seisMeses = new Date(agora);
  seisMeses.setMonth(seisMeses.getMonth() + 6);
  const emSeisMeses = seisMeses.toISOString().slice(0, 10);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
      <section aria-labelledby="lista" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="lista" className="font-heading text-lg font-bold">
            {escopo === "proprio" ? "Meus planos" : "Planos"}
          </h2>
          <form className="flex items-end gap-2">
            {pode(ctx, "pdi", "exportar") && <LinkExportar href="/pdi/exportar" />}
            <FiltroSelect nome="situacao" rotulo="Situação" valor={situacao} opcoes={Object.entries(SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Filtrar
            </button>
          </form>
        </div>
        {pdis.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum PDI nesta situação"
            descricao={escopoCriar ? "Crie um plano ao lado. Ele nasce como rascunho e é ativado quando tiver objetivos e ações." : "Quando seu gestor criar um PDI para você, ele aparece aqui."}
          />
        ) : (
          <Tabela colunas={["Pessoa", "Plano", "Período", "Situação", "Progresso"]} minWidth={760}>
            {pdis.map((p) => {
              const pct = progressoPdi(p.acoes);
              return (
                <tr key={p.id}>
                  <Celula>
                    <span className="flex items-center gap-3">
                      <Iniciais nome={p.colaborador.nome} />
                      <span className="min-w-0">
                        <span className="block font-medium">{p.colaborador.nome}</span>
                        <span className="block text-xs text-muted-foreground">{p.colaborador.cargo ?? "—"}</span>
                      </span>
                    </span>
                  </Celula>
                  <Celula>
                    <Link href={`/pdi/${p.id}`} className="font-medium hover:text-teal-strong">
                      {p.titulo}
                    </Link>
                  </Celula>
                  <Celula className="text-xs tabular-nums text-muted-foreground">
                    {formatarData(p.inicio)} – {formatarData(p.fim)}
                  </Celula>
                  <Celula>
                    <Selo tom={STATUS_PDI[p.status].tom}>{STATUS_PDI[p.status].nome}</Selo>
                  </Celula>
                  <Celula className="w-40">
                    <span className="mb-1 block text-xs tabular-nums text-muted-foreground">{pct}%</span>
                    <BarraProgresso valor={pct} rotulo={`Progresso do PDI de ${p.colaborador.nome}`} />
                  </Celula>
                </tr>
              );
            })}
          </Tabela>
        )}
        <Paginacao pagina={pagina} total={total} params={{ situacao }} />
      </section>

      {escopoCriar && !ctx.suporte && (
        <Cartao aria-labelledby="novo" className="h-fit">
          <CabecalhoCartao id="novo" titulo="Novo PDI" descricao="Para pessoas ativas, um plano aberto por vez." />
          <div className="px-5 pb-5">
            {pessoas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas as pessoas ativas no seu escopo já têm um PDI aberto.</p>
            ) : (
              <FormAcao action={criarPdi} textoBotao="Criar rascunho">
                <Selecao nome="colaboradorId" rotulo="Pessoa" opcoes={[{ valor: "", rotulo: "Selecione…" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))]} required />
                <Campo nome="titulo" rotulo="Título do plano" required placeholder="Ex.: Desenvolvimento 2026 · 2º semestre" />
                <div className="grid grid-cols-2 gap-3">
                  <Campo nome="inicio" rotulo="Início" type="date" defaultValue={hoje} required />
                  <Campo nome="fim" rotulo="Fim" type="date" defaultValue={emSeisMeses} required />
                </div>
              </FormAcao>
            )}
          </div>
        </Cartao>
      )}
    </div>
  );
}
