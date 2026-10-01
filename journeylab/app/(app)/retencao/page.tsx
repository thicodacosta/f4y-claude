import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, CircleDollarSign, DoorOpen, Hourglass, Repeat, UserMinus, Users } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { hoje } from "@/lib/datas";
import { uuidOuNada } from "@/lib/validacao";
import { carregarPeopleAnalytics } from "@/lib/analytics/indicadores";
import { resolverPeriodo, variacao } from "@/lib/analytics/calculo";
import { valorReferencia } from "@/lib/analytics/referencias";
import { MOTIVOS, nomeMotivo, type Motivo } from "@/lib/offboarding/motivos";
import { CabecalhoCartao, Cartao } from "@/components/app/painel";
import { Selo } from "@/components/app/lista";
import { FiltroPeriodo } from "@/components/analytics/filtro-periodo";
import { BarrasHorizontais, COR, Distribuicao, GraficoLinha, Indicador, Variacao, formatarIndicador as f } from "@/components/analytics/graficos";

export const metadata: Metadata = { title: "Retenção" };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Painel de retenção (RH/Admin): turnover, motivos, onde a jornada rompe e o que fazer. */
export default async function RetencaoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo } = await exigirModulo("retencao");
  if (escopo !== "todos") redirect("/retencao/risco");
  const sp = await searchParams;
  const periodo = resolverPeriodo(sp, hoje());
  const areaId = uuidOuNada(sp.area) ?? null;
  const d = await carregarPeopleAnalytics(ctx, periodo, areaId);
  const t = d.turnover;
  const refAnual = valorReferencia(d.config, "turnoverAnual");
  const topMotivo = (d.saida?.principaisReais[0]?.chave ?? d.saida?.motivosDeclarados[0]?.chave) as Motivo | undefined;
  const riscos = d.riscos ?? [];

  return (
    <>
      <FiltroPeriodo periodo={periodo.chave} de={periodo.inicio.toISOString().slice(0, 10)} ate={periodo.fim.toISOString().slice(0, 10)} area={areaId} areas={d.areas} />

      <section aria-label="Indicadores de retenção" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador
          rotulo="Turnover anualizado"
          valor={`${f(t.turnoverAnualizado)}%`}
          icone={Repeat}
          alerta={t.turnoverAnualizado !== null && t.turnoverAnualizado > refAnual}
          variacao={<Variacao valor={variacao(t.turnoverAnualizado, d.turnoverAnterior.turnoverAnualizado)} unidade=" p.p." menorMelhor />}
          detalhe={`${t.saidas} saída(s) · referência ${refAnual}%`}
        />
        <Indicador rotulo="Saídas voluntárias" valor={String(t.voluntarias)} icone={UserMinus} detalhe={`${f(t.turnoverVoluntarioAnualizado)}% anualizado · ${t.involuntarias} involuntária(s)`} />
        <Indicador rotulo="Perdas lamentadas" valor={String(t.lamentadas)} icone={AlertTriangle} alerta={t.lamentadas > 0} detalhe="Saídas que a empresa gostaria de ter evitado" />
        <Indicador rotulo="Saídas precoces" valor={String(t.precoces)} icone={Hourglass} detalhe={`Com menos de 90 dias · ${t.primeiroAno} no 1º ano`} alerta={t.saidas > 0 && t.precoces / t.saidas > valorReferencia(d.config, "saidaPrecoce") / 100} />
        <Indicador rotulo="Retenção em 12 meses" valor={`${f(d.pessoas.retencao12m)}%`} icone={Users} progresso={d.pessoas.retencao12m} detalhe={`Referência ${valorReferencia(d.config, "retencao12m")}%`} />
        <Indicador
          rotulo="Pessoas em risco alto"
          valor={String(riscos.filter((r) => r.nivel === "alto").length)}
          icone={AlertTriangle}
          alerta={riscos.some((r) => r.nivel === "alto")}
          detalhe={`${riscos.filter((r) => r.talentoChave && r.nivel !== "baixo").length} talento(s)-chave em risco`}
          href="/retencao/risco?nivel=alto"
        />
        <Indicador
          rotulo="Ações de retenção"
          valor={String(d.acoesRetencao?.abertas ?? 0)}
          icone={DoorOpen}
          alerta={!!d.acoesRetencao?.atrasadas}
          detalhe={`${d.acoesRetencao?.atrasadas ?? 0} atrasada(s) · ${d.acoesRetencao?.concluidasPeriodo ?? 0} concluída(s) no período`}
          href="/retencao/acoes"
        />
        <Indicador
          rotulo="Custo estimado"
          valor={d.custo ? brl(d.custo.total) : "—"}
          icone={CircleDollarSign}
          detalhe={d.custo ? `${brl(d.custo.porSaida)} por reposição` : "Defina as premissas em People Analytics › Referências"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Turnover mensal" descricao="Saídas do mês ÷ headcount médio" />
          <div className="px-5 pb-5">
            <GraficoLinha pontos={d.serie.map((p) => ({ rotulo: p.rotulo, valor: p.turnover }))} referencia={Math.round((refAnual / 12) * 10) / 10} rotuloReferencia="Referência mensal" />
          </div>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Risco de saída hoje" descricao="Pessoas ativas por nível de risco (indicativo)" />
          <div className="flex flex-col gap-4 px-5 pb-5">
            <Distribuicao
              partes={[
                { rotulo: "Alto", n: riscos.filter((r) => r.nivel === "alto").length, cor: COR.perigo },
                { rotulo: "Médio", n: riscos.filter((r) => r.nivel === "medio").length, cor: COR.alerta },
                { rotulo: "Baixo", n: riscos.filter((r) => r.nivel === "baixo").length, cor: COR.sucesso },
              ]}
            />
            <ul className="flex flex-col divide-y divide-border">
              {riscos.filter((r) => r.nivel === "alto").slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.fatores[0]?.texto}</span>
                  </span>
                  <Selo tom="perigo">{r.pontos} pts</Selo>
                </li>
              ))}
            </ul>
            <Link href="/retencao/risco" className="text-sm font-medium text-teal-strong hover:underline">
              Ver todas as pessoas →
            </Link>
          </div>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Motivos reais de saída" descricao={d.saida ? `${d.saida.entrevistadas} entrevista(s) · eNPS de saída ${d.saida.enps ?? "—"}` : "Offboarding não ativo"} />
          <div className="px-5 pb-5">
            {d.saida ? (
              <BarrasHorizontais itens={d.saida.motivosReais.map((m) => ({ rotulo: nomeMotivo(m.chave), valor: m.n }))} vazio="Nenhuma entrevista de desligamento respondida no período." />
            ) : (
              <p className="text-sm text-muted-foreground">Ative o Offboarding para registrar entrevistas de saída.</p>
            )}
          </div>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Onde a jornada se rompe" descricao="Saídas por tempo de casa" />
          <div className="px-5 pb-5">
            <BarrasHorizontais tom="perigo" itens={d.casa.map((c) => ({ rotulo: c.nome, valor: c.n }))} vazio="Sem saídas no período." />
          </div>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Turnover por área" descricao="Anualizado no período" />
          <div className="px-5 pb-5">
            <BarrasHorizontais unidade="%" tom="navy" itens={d.porArea.map((a) => ({ rotulo: a.nome, valor: a.turnoverAnualizado ?? 0, detalhe: `${a.saidas} saída(s)` }))} vazio="Sem áreas cadastradas." />
          </div>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Lideranças com saídas recorrentes" descricao="2 ou mais saídas voluntárias em 12 meses" />
          <div className="px-5 pb-5">
            <BarrasHorizontais tom="alerta" itens={d.porGestor.map((g) => ({ rotulo: g.nome, valor: g.saidasVoluntarias }))} vazio="Nenhuma liderança com saídas recorrentes no período." />
          </div>
        </Cartao>
      </div>

      {topMotivo && (
        <Cartao className="bg-brand-gradient-soft">
          <CabecalhoCartao titulo={`Para minimizar o impacto: ${MOTIVOS[topMotivo].nome}`} descricao="Principal fator de saída no período · ações recomendadas" />
          <div className="flex flex-col gap-3 px-5 pb-5">
            <ul className="grid gap-2 md:grid-cols-3">
              {MOTIVOS[topMotivo].acoes.map((a) => (
                <li key={a} className="rounded-md bg-card p-3 text-sm shadow-surface">
                  {a}
                </li>
              ))}
            </ul>
            <Link href={`/retencao/acoes?nova=1&categoria=${topMotivo}&origem=analytics#nova-acao`} className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Criar ação para este fator
            </Link>
          </div>
        </Cartao>
      )}
    </>
  );
}
