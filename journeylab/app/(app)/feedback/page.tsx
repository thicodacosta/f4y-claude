import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Lock } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroReunioes, STATUS_REUNIAO } from "@/lib/feedback/regras";
import { agendarReuniao } from "@/lib/feedback/actions";
import { valorPermitido } from "@/lib/validacao";
import { formatarDataHora } from "@/lib/formato";
import { EstadoVazio, FiltroSelect, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Selecao } from "@/components/admin/campos";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";

export const metadata: Metadata = { title: "Feedback 1:1" };

const PERIODO = { proximas: "Próximas", anteriores: "Anteriores", todas: "Todas" } as const;
const SITUACAO = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada" } as const;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
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

  const escopoCriar = pode(ctx, "feedback", "criar");
  const [total, reunioes, pessoas, modelos] = await Promise.all([
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
    escopoCriar
      ? db.colaborador.findMany({
          where: { status: "ativo", gestorId: escopoCriar === "todos" ? { not: null } : (ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000") },
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        })
      : [],
    escopoCriar ? db.modeloPauta.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [],
  ]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <section aria-labelledby="lista" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="lista" className="font-heading text-lg font-bold">
              Reuniões
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
              descricao={
                escopoCriar
                  ? "Agende uma conversa individual com alguém da sua equipe. A pauta pode partir de um modelo."
                  : "Quando seu gestor agendar um 1:1 com você, ele aparece aqui."
              }
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
                  <Celula className="tabular-nums">{formatarDataHora(r.dataHora.toISOString())}</Celula>
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
          {escopoCriar && (
            <Cartao aria-labelledby="agendar">
              <CabecalhoCartao id="agendar" titulo="Agendar 1:1" descricao={escopoCriar === "todos" ? "Com qualquer pessoa ativa que tenha gestor definido." : "Com seus liderados diretos."} />
              <div className="px-5 pb-5">
                {pessoas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma pessoa ativa disponível. Confira o gestor no cadastro de pessoas.</p>
                ) : (
                  <FormAcao action={agendarReuniao} textoBotao="Agendar">
                    <Selecao nome="colaboradorId" rotulo="Pessoa" opcoes={[{ valor: "", rotulo: "Selecione…" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))]} required />
                    <Campo nome="dataHora" rotulo="Data e hora" type="datetime-local" required />
                    <Selecao nome="modeloId" rotulo="Modelo de pauta" opcoes={[{ valor: "", rotulo: "Sem modelo" }, ...modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))]} />
                    <Area nome="pauta" rotulo="Tópicos adicionais" ajuda="Um por linha." rows={3} />
                  </FormAcao>
                )}
              </div>
            </Cartao>
          )}
          <Cartao className="bg-brand-gradient-soft p-5">
            <p className="flex items-center gap-2 font-heading font-bold">
              <Lock className="size-4 text-teal-strong" aria-hidden /> Privacidade das anotações
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Compartilhadas:</strong> vistas só pelos dois participantes.
              </li>
              <li>
                <strong className="text-foreground">Privadas:</strong> vistas só por quem escreveu.
              </li>
              <li>RH e administração veem apenas data, situação e compromissos.</li>
            </ul>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden /> Regra aplicada também no banco de dados.
            </p>
          </Cartao>
        </div>
      </div>
    </>
  );
}
