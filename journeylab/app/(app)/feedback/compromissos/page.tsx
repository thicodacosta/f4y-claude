import Link from "next/link";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroReunioes, STATUS_COMPROMISSO } from "@/lib/feedback/regras";
import { hojeSemHora } from "@/lib/onboarding/regras";
import { valorPermitido } from "@/lib/validacao";
import { formatarData } from "@/lib/formato";
import { EstadoVazio, FiltroSelect, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { LinkExportar } from "@/components/app/painel";

export const metadata: Metadata = { title: "Compromissos de 1:1" };

const SITUACAO = { aberto: "Abertos", concluido: "Concluídos", cancelado: "Cancelados" } as const;
const DE_QUEM = { meus: "Sob minha responsabilidade", todos: "Todos que vejo" } as const;

export default async function CompromissosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("feedback");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const situacao = valorPermitido(sp.situacao, SITUACAO) ?? "aberto";
  const deQuem = valorPermitido(sp.de, DE_QUEM) ?? (escopo === "proprio" ? "meus" : "todos");
  const where = {
    AND: [
      { reuniao: filtroReunioes(ctx, escopo), status: situacao },
      deQuem === "meus" ? { responsavelId: ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000" } : {},
    ],
  };
  const hoje = hojeSemHora();
  const [total, lista] = await Promise.all([
    db.compromisso.count({ where }),
    db.compromisso.findMany({
      where,
      include: {
        responsavel: { select: { nome: true } },
        reuniao: { select: { id: true, dataHora: true, colaborador: { select: { nome: true } } } },
        acaoPdi: { select: { pdiId: true } },
      },
      orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <section aria-labelledby="lista" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="lista" className="font-heading text-lg font-bold">
          Compromissos
        </h2>
        <form className="flex flex-wrap items-end gap-2">
          {pode(ctx, "feedback", "exportar") && <LinkExportar href="/feedback/exportar" />}
          <FiltroSelect nome="situacao" rotulo="Situação" valor={situacao} opcoes={Object.entries(SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          <FiltroSelect nome="de" rotulo="Responsável" valor={deQuem} opcoes={Object.entries(DE_QUEM).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Filtrar
          </button>
        </form>
      </div>
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhum compromisso nesta situação" descricao="Compromissos são registrados pelo gestor durante o 1:1 e aparecem aqui para acompanhamento." />
      ) : (
        <Tabela colunas={["Compromisso", "Responsável", "Prazo", "Situação", "Origem"]} minWidth={760}>
          {lista.map((c) => {
            const atrasado = c.status === "aberto" && c.prazo && c.prazo < hoje;
            return (
              <tr key={c.id}>
                <Celula className="max-w-md">
                  <span className="font-medium">{c.descricao}</span>
                  {c.acaoPdi && (
                    <Link href={`/pdi/${c.acaoPdi.pdiId}`} className="mt-0.5 block text-xs font-medium text-teal-strong hover:underline">
                      Acompanhado no PDI
                    </Link>
                  )}
                </Celula>
                <Celula>
                  <span className="flex items-center gap-2">
                    <Iniciais nome={c.responsavel.nome} className="size-7 text-[11px]" />
                    {c.responsavel.nome}
                  </span>
                </Celula>
                <Celula className={atrasado ? "font-semibold text-destructive" : "tabular-nums text-muted-foreground"}>
                  {c.prazo ? `${atrasado ? "Atrasado · " : ""}${formatarData(c.prazo)}` : "—"}
                </Celula>
                <Celula>
                  <Selo tom={STATUS_COMPROMISSO[c.status].tom}>{STATUS_COMPROMISSO[c.status].nome}</Selo>
                </Celula>
                <Celula>
                  <Link href={`/feedback/${c.reuniao.id}#compromisso-${c.id}`} className="text-sm hover:text-teal-strong">
                    1:1 de {c.reuniao.colaborador.nome.split(" ")[0]} · {formatarData(c.reuniao.dataHora)}
                  </Link>
                </Celula>
              </tr>
            );
          })}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ situacao, de: deQuem }} />
    </section>
  );
}
