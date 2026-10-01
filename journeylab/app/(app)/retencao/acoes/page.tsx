import Link from "next/link";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { uuidOuNada, valorPermitido } from "@/lib/validacao";
import { nomeMotivo } from "@/lib/offboarding/motivos";
import { ALCANCE, filtroAcoesRetencao, STATUS_ACAO_RETENCAO } from "@/lib/retencao-talentos/regras";
import { filtroRetencao } from "@/lib/retencao-talentos/risco";
import type { Prisma } from "@/lib/generated/prisma/client";
import { CabecalhoCartao, Cartao } from "@/components/app/painel";
import { EstadoVazio, FiltroSelect, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { FormAcaoRetencao } from "@/components/retencao/form-acao";
import { StatusAcaoRetencao } from "@/components/retencao/status-acao";

export const metadata: Metadata = { title: "Ações de retenção" };

const SITUACOES = { abertas: "Em aberto", atrasadas: "Atrasadas", concluidas: "Concluídas", todas: "Todas" } as const;

export default async function AcoesRetencaoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("retencao");
  const sp = await searchParams;
  const situacao = valorPermitido(sp.situacao, SITUACOES) ?? "abertas";
  const pessoa = uuidOuNada(sp.pessoa);
  const h = hoje();
  const where: Prisma.AcaoRetencaoWhereInput = {
    AND: [
      filtroAcoesRetencao(ctx, escopo),
      pessoa ? { colaboradorId: pessoa } : {},
      situacao === "abertas"
        ? { status: { in: ["planejada", "em_andamento"] } }
        : situacao === "atrasadas"
          ? { status: { in: ["planejada", "em_andamento"] }, prazo: { lt: h } }
          : situacao === "concluidas"
            ? { status: "concluida" }
            : {},
    ],
  };
  const podeCriar = !!pode(ctx, "retencao", "criar") && !ctx.suporte;
  const podeEditar = !!pode(ctx, "retencao", "editar") && !ctx.suporte;
  const [acoes, pessoas, equipes, responsaveis] = await Promise.all([
    db.acaoRetencao.findMany({
      where,
      include: { colaborador: { select: { id: true, nome: true } }, equipe: { select: { nome: true } }, responsavel: { select: { nome: true } } },
      orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
      take: 300,
    }),
    podeCriar ? db.colaborador.findMany({ where: { AND: [{ status: "ativo" }, filtroRetencao(ctx, escopo)] }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [],
    podeCriar ? db.equipe.findMany({ where: escopo === "todos" ? {} : { gestorId: ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [],
    podeCriar ? db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [],
  ]);

  return (
    <>
      {podeCriar && (
        <Cartao>
          <CabecalhoCartao titulo="Nova ação de retenção" descricao="Escolha o fator de saída que a ação trata — o playbook sugere ações com bom histórico de resultado." />
          <div className="px-5 pb-5">
            <FormAcaoRetencao
              pessoas={pessoas}
              equipes={equipes}
              responsaveis={responsaveis}
              podeOrganizacao={escopo === "todos"}
              inicial={{ colaboradorId: uuidOuNada(sp.colaborador), equipeId: uuidOuNada(sp.equipe), categoria: sp.categoria, origem: sp.origem }}
            />
          </div>
        </Cartao>
      )}
      <form className="flex flex-wrap items-end gap-2">
        <FiltroSelect nome="situacao" rotulo="Situação" valor={situacao} opcoes={Object.entries(SITUACOES).map(([valor, rotulo]) => ({ valor, rotulo }))} />
        {pessoa && <input type="hidden" name="pessoa" value={pessoa} />}
        <button type="submit" className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
          Filtrar
        </button>
        {pessoa && (
          <Link href="/retencao/acoes" className="h-10 content-center px-2 text-sm text-teal-strong hover:underline">
            Limpar pessoa
          </Link>
        )}
      </form>
      {acoes.length === 0 ? (
        <EstadoVazio titulo="Nenhuma ação nesta situação" descricao="Crie ações a partir do risco de saída, dos motivos de desligamento ou dos insights do People Analytics." />
      ) : (
        <Tabela colunas={["Ação", "Fator", "Alcance", "Responsável", "Prazo", "Situação"]} minWidth={980}>
          {acoes.map((a) => {
            const atrasada = (a.status === "planejada" || a.status === "em_andamento") && a.prazo && a.prazo < h;
            return (
              <tr key={a.id}>
                <Celula>
                  <span className="font-medium">{a.titulo}</span>
                  {a.descricao && <span className="block max-w-md text-xs text-muted-foreground">{a.descricao}</span>}
                  {a.resultado && <span className="block max-w-md text-xs text-[#0E7A4E] dark:text-success">Resultado: {a.resultado}</span>}
                </Celula>
                <Celula className="text-muted-foreground">{nomeMotivo(a.categoria)}</Celula>
                <Celula className="text-muted-foreground">
                  {ALCANCE[a.alcance as keyof typeof ALCANCE] ?? a.alcance}
                  <span className="block text-xs">
                    {a.colaborador ? (
                      <Link href={`/colaboradores/${a.colaborador.id}`} className="hover:text-teal-strong">
                        {a.colaborador.nome}
                      </Link>
                    ) : (
                      (a.equipe?.nome ?? "")
                    )}
                  </span>
                </Celula>
                <Celula className="text-muted-foreground">{a.responsavel?.nome ?? "—"}</Celula>
                <Celula className={atrasada ? "font-medium text-destructive" : "tabular-nums text-muted-foreground"}>{a.prazo ? `${formatarData(a.prazo)}${atrasada ? " · atrasada" : ""}` : "—"}</Celula>
                <Celula>
                  {podeEditar ? <StatusAcaoRetencao id={a.id} status={a.status} titulo={a.titulo} /> : <Selo tom={STATUS_ACAO_RETENCAO[a.status].tom}>{STATUS_ACAO_RETENCAO[a.status].nome}</Selo>}
                </Celula>
              </tr>
            );
          })}
        </Tabela>
      )}
    </>
  );
}
