import Link from "next/link";
import type { Metadata } from "next";
import { Lock, Repeat } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { filtroReunioes, STATUS_REUNIAO } from "@/lib/feedback/regras";
import { valorPermitido } from "@/lib/validacao";
import { formatarDataHora } from "@/lib/formato";
import { EstadoVazio, FiltroSelect, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao } from "@/components/app/painel";

export const metadata: Metadata = { title: "Agenda 1:1" };

const PERIODO = { proximas: "Próximas", anteriores: "Anteriores", todas: "Todas" } as const;
const SITUACAO = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada" } as const;

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("feedback");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const periodo = valorPermitido(sp.periodo, PERIODO) ?? "proximas";
  const situacao = valorPermitido(sp.situacao, SITUACAO);
  const agora = new Date();
  const where = {
    AND: [
      filtroReunioes(ctx, escopo),
      situacao ? { status: situacao } : {},
      periodo === "proximas" ? { dataHora: { gte: new Date(agora.getTime() - 2 * 3600_000) } } : periodo === "anteriores" ? { dataHora: { lt: agora } } : {},
    ],
  };
  const [total, reunioes] = await Promise.all([
    db.reuniao.count({ where }),
    db.reuniao.findMany({
      where,
      include: {
        colaborador: { select: { nome: true, cargo: true } },
        gestor: { select: { nome: true } },
        _count: { select: { compromissos: { where: { status: "aberto" } } } },
      },
      orderBy: { dataHora: periodo === "proximas" ? "asc" : "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,320px)]">
      <section aria-labelledby="lista" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="lista" className="font-heading text-lg font-bold">
            Agenda de 1:1
          </h2>
          <form className="flex flex-wrap items-end gap-2">
            <FiltroSelect nome="periodo" rotulo="Período" valor={periodo} opcoes={Object.entries(PERIODO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <FiltroSelect nome="situacao" rotulo="Situação" valor={situacao} opcoes={Object.entries(SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Filtrar
            </button>
          </form>
        </div>
        {reunioes.length === 0 ? (
          <EstadoVazio
            titulo={periodo === "proximas" ? "Nenhum 1:1 agendado" : "Nenhuma reunião encontrada"}
            descricao="As conversas 1:1 registradas aparecem aqui."
          />
        ) : (
          <Tabela colunas={["Pessoa", "Gestor", "Quando", "Situação", "Compromissos"]} minWidth={720}>
            {reunioes.map((r) => (
              <tr key={r.id}>
                <Celula>
                  <span className="flex items-center gap-3">
                    <Iniciais nome={r.colaborador.nome} />
                    <span className="min-w-0">
                      <Link href={`/feedback/${r.id}`} className="font-medium hover:text-teal-strong">
                        {r.colaborador.nome}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{r.colaborador.cargo ?? "—"}</span>
                    </span>
                  </span>
                </Celula>
                <Celula className="text-muted-foreground">{r.gestor.nome}</Celula>
                <Celula className="tabular-nums">
                  {formatarDataHora(r.dataHora.toISOString())}
                  <span className="block text-xs text-muted-foreground">
                    {r.duracaoMin} min{r.serieId && <Repeat className="ml-1 inline size-3" aria-label="recorrente" />}
                  </span>
                </Celula>
                <Celula>
                  <Selo tom={STATUS_REUNIAO[r.status].tom}>{STATUS_REUNIAO[r.status].nome}</Selo>
                </Celula>
                <Celula className="tabular-nums text-muted-foreground">{r._count.compromissos ? `${r._count.compromissos} aberto(s)` : "—"}</Celula>
              </tr>
            ))}
          </Tabela>
        )}
        <Paginacao pagina={pagina} total={total} params={{ periodo, situacao }} />
      </section>

      <div className="flex flex-col gap-4">
        <Cartao className="bg-brand-gradient-soft p-5">
          <p className="flex items-center gap-2 font-heading font-bold">
            <Lock className="size-4 text-teal-strong" aria-hidden /> Anotações das reuniões
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Anotações privadas ficam visíveis só para quem escreveu. RH e administração veem data, situação e compromissos — regra aplicada também no banco de dados.
          </p>
        </Cartao>
      </div>
    </div>
  );
}
