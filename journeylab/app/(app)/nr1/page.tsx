import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, ClipboardList, Plus, Users } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { formatarData } from "@/lib/formato";
import { adesaoNr1, resultadoNr1 } from "@/lib/nr1/consultas";
import { faixaDe, LIMITACOES } from "@/lib/nr1/calculo";
import { AUDIENCIA_NR1, AVISO_NR1, filtroCiclos, STATUS_CICLO } from "@/lib/nr1/regras";
import { TIPO_DIAGNOSTICO } from "@/lib/nr1/questionario";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao, CartaoKpi } from "@/components/app/painel";
import { Evolucao } from "@/components/nr1/graficos";

export const metadata: Metadata = { title: "Diagnóstico NR-1" };

export default async function Nr1Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("nr1");
  const sp = await searchParams;
  const gestao = pode(ctx, "nr1", "criar") === "todos" && !ctx.suporte;
  if (sp.action === "create" && gestao) redirect("/nr1/novo");
  const ciclos = await db.cicloNr1.findMany({ where: filtroCiclos(escopo), include: { dimensoes: { select: { id: true, nome: true, fatorChave: true } } }, orderBy: { criadoEm: "desc" }, take: 60 });
  const porStatus = (s: keyof typeof STATUS_CICLO) => ciclos.filter((c) => c.status === s).length;

  // Participação agregada (só para quem administra) e resultados dos encerrados (regras de proteção no banco).
  const adesoes = escopo === "todos" ? new Map(await Promise.all(ciclos.filter((c) => c.status !== "rascunho").map(async (c) => [c.id, await adesaoNr1(ctx, c.id)] as const))) : new Map();
  const encerrados = ciclos.filter((c) => c.status === "encerrado").slice(0, 8);
  const resultados = escopo === "todos" ? new Map(await Promise.all(encerrados.map(async (c) => [c.id, await resultadoNr1(ctx, c.id, null)] as const))) : new Map();
  const ativos = ciclos.filter((c) => c.status === "aberto");
  const respostasAtivas = ativos.reduce((n, c) => n + (adesoes.get(c.id)?.respostas ?? 0), 0);
  const elegiveisAtivos = ativos.reduce((n, c) => n + (adesoes.get(c.id)?.elegiveis ?? 0), 0);

  const ultimo = encerrados.find((c) => resultados.get(c.id)?.resumo?.liberado);
  const alertas = ultimo
    ? resultados
        .get(ultimo.id)!
        .fatores.filter((f: { score: number | null }) => f.score !== null && faixaDe(f.score, ultimo.faixas).indice >= 3)
        .map((f: { dimensao_id: string; score: number }) => ({ nome: ultimo.dimensoes.find((d) => d.id === f.dimensao_id)?.nome ?? "", score: f.score }))
    : [];
  const comparaveis = ultimo ? encerrados.filter((c) => c.metodologiaVersao === ultimo.metodologiaVersao && resultados.get(c.id)?.geral !== null && resultados.get(c.id)?.geral !== undefined) : [];

  return (
    <>
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">{AVISO_NR1}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoKpi rotulo="Rascunhos" valor={String(porStatus("rascunho"))} detalhe="Em preparação" href="/nr1#lista" icone={ClipboardList} />
        <CartaoKpi rotulo="Ativos" valor={String(porStatus("aberto"))} detalhe={ativos.length ? `${respostasAtivas} resposta(s) de ${elegiveisAtivos} elegíveis` : "Nenhum em coleta"} href="/nr1#lista" icone={Users} />
        <CartaoKpi rotulo="Encerrados" valor={String(porStatus("encerrado"))} detalhe="Com resultados agregados" href="/nr1#lista" icone={ClipboardList} />
        <CartaoKpi rotulo="Fatores para análise" valor={String(alertas.length)} detalhe={ultimo ? `Exposição elevada no último diagnóstico` : "Aguardando resultados"} href={ultimo ? `/nr1/${ultimo.id}` : "/nr1"} icone={AlertTriangle} alerta={alertas.length > 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,380px)]">
        <section id="lista" aria-labelledby="diagnosticos" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="diagnosticos" className="font-heading text-lg font-bold">
              Diagnósticos
            </h2>
            {gestao && (
              <Link href="/nr1/novo" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4" aria-hidden /> Novo diagnóstico
              </Link>
            )}
          </div>
          {ciclos.length === 0 ? (
            <EstadoVazio
              titulo={escopo === "todos" ? "Nenhum diagnóstico" : "Nenhum resultado disponível"}
              descricao={escopo === "todos" ? "Crie um diagnóstico com a biblioteca de 50 perguntas (13 fatores) ou uma versão rápida." : "Resultados das suas áreas aparecem após o encerramento, quando houver respostas suficientes."}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {ciclos.map((c) => {
                const a = adesoes.get(c.id);
                const r = resultados.get(c.id);
                return (
                  <li key={c.id} className="rounded-lg border border-border bg-card p-4 shadow-surface">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={`/nr1/${c.id}`} className="font-heading font-bold hover:text-teal-strong">
                        {c.titulo}
                      </Link>
                      <Selo tom={STATUS_CICLO[c.status].tom}>{STATUS_CICLO[c.status].nome}</Selo>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.metodologiaVersao === "legado" ? "Questionário anterior" : TIPO_DIAGNOSTICO[c.tipo].nome} · {AUDIENCIA_NR1[c.audienciaTipo as keyof typeof AUDIENCIA_NR1] ?? c.audienciaTipo}
                      {c.dataInicio && ` · ${formatarData(c.dataInicio)}`}
                      {c.encerraEm && ` – ${formatarData(c.encerraEm)}`}
                    </p>
                    {a && (
                      <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                        {a.elegiveis} elegíveis · {a.enviados} convites enviados{a.falhas ? ` · ${a.falhas} falha(s)` : ""} · <strong className="text-foreground">{a.respostas} resposta(s) recebida(s)</strong>
                      </p>
                    )}
                    {r && (
                      <p className="mt-1 text-xs">
                        {r.resumo?.liberado && r.geral !== null ? (
                          <>
                            Score indicativo geral <strong className="tabular-nums">{r.geral}</strong> · {faixaDe(r.geral, c.faixas).nome} · amostra de {r.resumo.respondentes}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Dados insuficientes para exibição segura.</span>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <Cartao aria-labelledby="alertas">
            <CabecalhoCartao id="alertas" titulo="Fatores que precisam de análise" descricao={ultimo ? `${ultimo.titulo} · faixa “exposição elevada” ou acima` : "Aparecem após um diagnóstico encerrado com respostas suficientes."} />
            <ul className="flex flex-col gap-1 px-5 pb-5 text-sm">
              {ultimo && alertas.length === 0 && <li className="text-muted-foreground">Nenhum fator na faixa de exposição elevada. Isso não substitui a avaliação técnica.</li>}
              {alertas.map((f: { nome: string; score: number }) => (
                <li key={f.nome} className="flex justify-between gap-2">
                  <span>{f.nome}</span>
                  <strong className="tabular-nums">{f.score}</strong>
                </li>
              ))}
            </ul>
          </Cartao>
          {escopo === "todos" && (
            <Cartao aria-labelledby="evolucao" className="pb-5">
              <CabecalhoCartao id="evolucao" titulo="Evolução entre ciclos comparáveis" descricao="Score indicativo geral de diagnósticos com a mesma metodologia." />
              <div className="px-5">
                <Evolucao pontos={[...comparaveis].reverse().map((c) => ({ rotulo: formatarData(c.encerradoEm ?? c.criadoEm), valor: resultados.get(c.id)!.geral! }))} />
              </div>
            </Cartao>
          )}
          <p className="text-xs text-muted-foreground">{LIMITACOES}</p>
        </div>
      </div>
    </>
  );
}
