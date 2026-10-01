import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck, DoorClosed, Gauge, MailQuestion } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje, somarDias } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import type { Prisma } from "@/lib/generated/prisma/client";
import { calcularEnpsNotas } from "@/lib/offboarding/questionario";
import { nomeMotivo, STATUS_ENTREVISTA, TIPO_DESLIGAMENTO } from "@/lib/offboarding/motivos";
import { LinkExportar } from "@/components/app/painel";
import { BarraBusca, EstadoVazio, FiltroSelect, Iniciais, Paginacao, paginaDe, POR_PAGINA, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Indicador } from "@/components/analytics/graficos";

export const metadata: Metadata = { title: "Offboarding" };

const INICIATIVA = { voluntaria: "Voluntária", involuntaria: "Involuntária" } as const;

const tempoCasa = (adm: Date | null, saida: Date) => {
  if (!adm) return "—";
  const m = Math.round((saida.getTime() - adm.getTime()) / (30.4375 * 86_400_000));
  return m >= 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m}m`;
};

export default async function OffboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, db } = await exigirModulo("offboarding");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const entrevista = valorPermitido(sp.entrevista, STATUS_ENTREVISTA);
  const iniciativa = valorPermitido(sp.iniciativa, INICIATIVA);
  const where: Prisma.DesligamentoWhereInput = {
    AND: [
      sp.q ? { colaborador: { nome: { contains: sp.q.slice(0, 80), mode: "insensitive" } } } : {},
      entrevista ? { entrevistaStatus: entrevista } : {},
      iniciativa ? { voluntario: iniciativa === "voluntaria" } : {},
    ],
  };
  const h = hoje();
  const [total, lista, ano] = await Promise.all([
    db.desligamento.count({ where }),
    db.desligamento.findMany({ where, include: { colaborador: { select: { nome: true } } }, orderBy: { data: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    db.desligamento.findMany({ where: { data: { gte: somarDias(h, -364) } }, select: { voluntario: true, entrevistaStatus: true, enps: true } }),
  ]);
  const pendentes = ano.filter((x) => x.entrevistaStatus === "pendente" || x.entrevistaStatus === "enviada").length;
  const respondidas = ano.filter((x) => x.entrevistaStatus === "respondida");
  const elegiveis = ano.filter((x) => x.entrevistaStatus !== "dispensada").length;
  const enps = calcularEnpsNotas(respondidas.map((x) => x.enps).filter((n): n is number => n !== null));

  return (
    <>
      <section aria-label="Resumo dos últimos 12 meses" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Desligamentos (12 meses)" valor={String(ano.length)} icone={DoorClosed} detalhe={`${ano.filter((x) => x.voluntario).length} voluntário(s)`} />
        <Indicador rotulo="Entrevistas respondidas" valor={String(respondidas.length)} icone={ClipboardCheck} detalhe={elegiveis ? `${Math.round((respondidas.length / elegiveis) * 100)}% das saídas` : "—"} progresso={elegiveis ? (respondidas.length / elegiveis) * 100 : null} />
        <Indicador rotulo="Entrevistas pendentes" valor={String(pendentes)} icone={MailQuestion} alerta={pendentes > 0} detalhe="Pendentes ou aguardando resposta" href="/offboarding?entrevista=pendente" />
        <Indicador rotulo="eNPS de saída" valor={enps === null ? "—" : String(enps)} icone={Gauge} detalhe="Quanto quem saiu recomendaria a empresa (−100 a 100)" />
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <BarraBusca q={sp.q} placeholder="Nome do colaborador">
            <FiltroSelect nome="entrevista" rotulo="Entrevista" valor={entrevista} opcoes={Object.entries(STATUS_ENTREVISTA).map(([valor, s]) => ({ valor, rotulo: s.nome }))} />
            <FiltroSelect nome="iniciativa" rotulo="Iniciativa" valor={iniciativa} opcoes={Object.entries(INICIATIVA).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          </BarraBusca>
        </div>
        {pode(ctx, "offboarding", "exportar") && <LinkExportar href="/offboarding/exportar" />}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo={sp.q || entrevista || iniciativa ? "Nenhum desligamento com esses filtros" : "Nenhum desligamento registrado"}
          descricao="Registre cada saída e conduza a entrevista de desligamento: é a forma mais fiel de entender os motivos reais e agir em Retenção."
          acao={
            pode(ctx, "offboarding", "criar") && !ctx.suporte ? (
              <Link href="/offboarding/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Registrar desligamento
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Tabela colunas={["Colaborador", "Data", "Tipo", "Motivo informado", "Motivo real", "Entrevista"]} minWidth={980}>
          {lista.map((x) => (
            <tr key={x.id}>
              <Celula>
                <span className="flex items-center gap-3">
                  <Iniciais nome={x.colaborador.nome} />
                  <span className="min-w-0">
                    <Link href={`/offboarding/${x.id}`} className="font-medium hover:text-teal-strong">
                      {x.colaborador.nome}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {[x.cargo, x.areaNome ?? x.equipeNome].filter(Boolean).join(" · ") || "—"} · {tempoCasa(x.admissao, x.data)} de casa
                    </span>
                  </span>
                </span>
              </Celula>
              <Celula className="tabular-nums text-muted-foreground">{formatarData(x.data)}</Celula>
              <Celula>
                <span className="text-sm">{TIPO_DESLIGAMENTO[x.tipo].nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {x.voluntario ? "Voluntária" : "Involuntária"}
                  {x.perdaLamentada && " · perda lamentada"}
                </span>
              </Celula>
              <Celula className="text-muted-foreground">{nomeMotivo(x.motivoDeclarado)}</Celula>
              <Celula>{x.motivoPrincipalReal ? <span className={x.motivoPrincipalReal !== x.motivoDeclarado ? "font-medium" : ""}>{nomeMotivo(x.motivoPrincipalReal)}</span> : <span className="text-muted-foreground">—</span>}</Celula>
              <Celula>
                <Selo tom={STATUS_ENTREVISTA[x.entrevistaStatus as keyof typeof STATUS_ENTREVISTA]?.tom ?? "neutro"}>{STATUS_ENTREVISTA[x.entrevistaStatus as keyof typeof STATUS_ENTREVISTA]?.nome ?? x.entrevistaStatus}</Selo>
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q, entrevista, iniciativa }} />
    </>
  );
}
