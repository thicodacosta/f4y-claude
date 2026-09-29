import Link from "next/link";
import type { Metadata } from "next";
import { Activity, CheckCircle2, ShieldCheck } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { equipesLideradas, filtroParaResponder, filtroPesquisas, MODELOS_PULSE, STATUS_PESQUISA } from "@/lib/pulse/regras";
import { criarPesquisa } from "@/lib/pulse/actions";
import { valorPermitido } from "@/lib/validacao";
import { formatarData } from "@/lib/formato";
import { EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao, ItemAtividade } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Pulse" };

export default async function PulsePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const sp = await searchParams;
  const escopo = pode(ctx, "pulse", "visualizar");
  const pagina = paginaDe(sp.pagina);
  const status = valorPermitido(sp.status, STATUS_PESQUISA);

  const eu = ctx.colaboradorId ? await db.colaborador.findUnique({ where: { id: ctx.colaboradorId }, select: { id: true, equipeId: true, status: true } }) : null;
  const paraResponder =
    eu?.status === "ativo" && !ctx.suporte
      ? await db.pesquisaPulse.findMany({ where: filtroParaResponder(eu.id, eu.equipeId), orderBy: { encerraEm: { sort: "asc", nulls: "last" } }, take: 20 })
      : [];

  const equipes = escopo === "equipe" ? (await equipesLideradas(ctx)).map((e) => e.id) : [];
  const where = escopo ? { AND: [filtroPesquisas(escopo, equipes), status ? { status } : {}] } : null;
  const [total, pesquisas] = where
    ? await Promise.all([
        db.pesquisaPulse.count({ where }),
        db.pesquisaPulse.findMany({
          where,
          include: { _count: { select: { perguntas: true } } },
          orderBy: { criadoEm: "desc" },
          skip: (pagina - 1) * POR_PAGINA,
          take: POR_PAGINA,
        }),
      ])
    : [0, []];
  const podeCriar = pode(ctx, "pulse", "criar") === "todos" && !ctx.suporte;

  return (
    <>
      {sp.respondido && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> Resposta registrada de forma anônima. Obrigado por participar!
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao aria-labelledby="responder">
            <CabecalhoCartao id="responder" titulo="Para responder" descricao="Pesquisas abertas das quais você faz parte." />
            <div className="px-3 pb-3">
              {paraResponder.length === 0 ? (
                <p className="px-2 pb-3 text-sm text-muted-foreground">Nenhuma pesquisa pendente para você.</p>
              ) : (
                <ul>
                  {paraResponder.map((p) => (
                    <ItemAtividade
                      key={p.id}
                      href={`/pulse/responder/${p.id}`}
                      icone={Activity}
                      titulo={p.titulo}
                      subtitulo="Anônima · leva poucos minutos"
                      valor={p.encerraEm ? `Até ${formatarData(p.encerraEm)}` : "Responder"}
                    />
                  ))}
                </ul>
              )}
            </div>
          </Cartao>

          {escopo && (
            <section aria-labelledby="pesquisas" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="pesquisas" className="font-heading text-lg font-bold">
                  {escopo === "todos" ? "Pesquisas" : "Pesquisas das suas equipes"}
                </h2>
                <form className="flex items-end gap-2">
                  <FiltroSelect nome="status" rotulo="Situação" valor={status} opcoes={Object.entries(STATUS_PESQUISA).map(([valor, s]) => ({ valor, rotulo: s.nome }))} />
                  <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    Filtrar
                  </button>
                </form>
              </div>
              {pesquisas.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhuma pesquisa"
                  descricao={podeCriar ? "Crie uma pesquisa curta a partir de um modelo ou em branco." : "Quando houver pesquisas encerradas com público nas suas equipes, os resultados agregados aparecem aqui."}
                />
              ) : (
                <Tabela colunas={["Pesquisa", "Público", "Perguntas", "Situação", "Encerramento"]} minWidth={700}>
                  {pesquisas.map((p) => (
                    <tr key={p.id}>
                      <Celula>
                        <Link href={`/pulse/${p.id}`} className="font-medium hover:text-teal-strong">
                          {p.titulo}
                        </Link>
                        <span className="block text-xs text-muted-foreground">Criada por {p.criadoPor}</span>
                      </Celula>
                      <Celula className="text-muted-foreground">{p.publicoTodos ? "Toda a organização" : `${p.equipeIds.length} equipe(s)`}</Celula>
                      <Celula className="tabular-nums text-muted-foreground">{p._count.perguntas}</Celula>
                      <Celula>
                        <Selo tom={STATUS_PESQUISA[p.status].tom}>{STATUS_PESQUISA[p.status].nome}</Selo>
                      </Celula>
                      <Celula className="tabular-nums text-muted-foreground">
                        {p.encerradaEm ? formatarData(p.encerradaEm) : p.encerraEm ? `Previsto ${formatarData(p.encerraEm)}` : "—"}
                      </Celula>
                    </tr>
                  ))}
                </Tabela>
              )}
              <Paginacao pagina={pagina} total={total} params={{ status }} />
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {podeCriar && (
            <Cartao aria-labelledby="nova">
              <CabecalhoCartao id="nova" titulo="Nova pesquisa" descricao="Nasce como rascunho; perguntas ficam fixas ao abrir." />
              <div className="px-5 pb-5">
                <FormAcao action={criarPesquisa} textoBotao="Criar rascunho">
                  <Campo nome="titulo" rotulo="Título" required placeholder="Ex.: Pulse de clima · outubro" />
                  <Selecao
                    nome="modelo"
                    rotulo="Começar com"
                    opcoes={[{ valor: "", rotulo: "Pesquisa em branco" }, ...Object.entries(MODELOS_PULSE).map(([valor, m]) => ({ valor, rotulo: `Modelo: ${m.nome}` }))]}
                  />
                </FormAcao>
              </div>
            </Cartao>
          )}
          <Cartao className="bg-brand-gradient-soft p-5">
            <p className="flex items-center gap-2 font-heading font-bold">
              <ShieldCheck className="size-4 text-teal-strong" aria-hidden /> Como protegemos o anonimato
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
              <li>As respostas não guardam quem respondeu nem o horário.</li>
              <li>Ninguém da organização — nem o JourneyLab — lê respostas individuais.</li>
              <li>
                Resultados só depois do encerramento e com pelo menos <strong className="text-foreground">{ctx.org.minimoRecorte} respondentes</strong> em cada recorte.
              </li>
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
