import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, FileText, Pencil, Sparkles } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import { iaDisponivel } from "@/lib/ia";
import { adesaoNr1 } from "@/lib/nr1/consultas";
import { carregarRelatorioNr1, type Recorte } from "@/lib/nr1/relatorio";
import { faixaDe, LIMITACOES, MOTIVO_OCULTO } from "@/lib/nr1/calculo";
import { AUDIENCIA_NR1, AVISO_NR1, PRIORIDADE, STATUS_ACAO_NR1, STATUS_CICLO } from "@/lib/nr1/regras";
import { ESCALA_NR1, TIPO_DIAGNOSTICO } from "@/lib/nr1/questionario";
import type { SugestoesNr1 } from "@/lib/nr1/actions";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { BarrasFatores, Evolucao, LegendaFaixas, MatrizIndicativa, RadarFatores } from "@/components/nr1/graficos";
import { AtualizarAcao, BotaoNr1, NovaAcao, NovoRisco, PreviaSugestoes, RevisarMatriz, StatusRisco } from "@/components/nr1/acoes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Diagnóstico · NR-1" };

const ABAS = { visao: "Visão geral", departamentos: "Departamentos", matriz: "Matriz indicativa", evolucao: "Evolução", plano: "Plano de ação", convites: "Convites" } as const;

function Oculto({ resumo }: { resumo: Recorte["resumo"] }) {
  return <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">{resumo?.motivo ? (MOTIVO_OCULTO[resumo.motivo] ?? MOTIVO_OCULTO.minimo) : "Aguardando respostas."}</p>;
}

function Metodologia({ c }: { c: { metodologiaVersao: string; faixas: number[] } }) {
  return (
    <details className="rounded-lg border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Metodologia de pontuação ({c.metodologiaVersao})</summary>
      <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
        <p>
          Escala de frequência: {ESCALA_NR1.map((e) => `${e.valor} = ${e.rotulo}`).join(", ")}. Itens redigidos de forma positiva têm pontuação reversa (6 − resposta), para que valores maiores sempre indiquem
          mais exposição. “Prefiro não responder” não entra no cálculo (não vira nota 1).
        </p>
        <p>Score do fator = arredondar(((média ajustada − 1) ÷ 4) × 100). Score geral = média simples dos fatores exibidos. Fatores ou recortes com menos respostas que o mínimo da organização não são exibidos.</p>
        <LegendaFaixas faixas={c.faixas} />
        <p>As faixas são critérios internos do produto, configuráveis por diagnóstico — não são classificação oficial da NR-1.</p>
      </div>
    </details>
  );
}

export default async function DiagnosticoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { ctx, escopo } = await exigirModulo("nr1");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const rel = await carregarRelatorioNr1(ctx, id);
  if (!rel) notFound();
  const { ciclo: c, organizacao, departamentos, evolucao } = rel;
  const gestao = escopo === "todos" && pode(ctx, "nr1", "editar") === "todos" && !ctx.suporte;
  const abasVisiveis = (Object.keys(ABAS) as (keyof typeof ABAS)[]).filter((a) => (escopo === "todos" ? true : a === "departamentos"));
  const aba = (valorPermitido(sp.tab, ABAS) as keyof typeof ABAS | undefined) ?? abasVisiveis[0];
  const adesao = escopo === "todos" && c.status !== "rascunho" ? await adesaoNr1(ctx, c.id) : null;
  const fatoresSimples = c.dimensoes.map((d) => ({ id: d.id, nome: d.nome }));

  let conteudo: React.ReactNode = null;
  if (c.status === "rascunho") {
    conteudo = (
      <div className="flex flex-col gap-4">
        <Cartao className="p-5">
          <h3 className="font-heading font-bold">Revisão do questionário ({c.dimensoes.reduce((n, d) => n + d.perguntas.length, 0)} perguntas)</h3>
          <p className="mt-1 text-xs text-muted-foreground">Biblioteca do JourneyLab, criada para o produto — não é questionário oficial do MTE. “Reversa” = item positivo (pontua 6 − resposta).</p>
          <ol className="mt-3 flex flex-col gap-3">
            {c.dimensoes.map((d) => (
              <li key={d.id}>
                <p className="font-semibold">{d.nome}</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                  {d.perguntas.map((q) => (
                    <li key={q.id} className="flex justify-between gap-3">
                      <span>{q.texto}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{q.reversa ? "reversa" : "direta"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Cartao>
        <Cartao className="p-5 text-sm">
          <h3 className="font-heading font-bold">Convite por e-mail</h3>
          <p className="mt-1 text-muted-foreground">{c.mensagemConvite || "Sem mensagem adicional."}</p>
          <p className="mt-2 text-xs text-muted-foreground">O e-mail inclui prazo, link pessoal de uso único e a explicação de privacidade exibida também na página de resposta.</p>
        </Cartao>
        <Metodologia c={c} />
      </div>
    );
  } else if (aba === "visao") {
    const org = organizacao!;
    conteudo = (
      <div className="flex flex-col gap-4">
        {adesao && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["Pessoas elegíveis", adesao.elegiveis],
                ["Convites enviados", adesao.enviados],
                ["Falhas de envio", adesao.falhas],
                ["Respostas recebidas", adesao.respostas],
              ] as const
            ).map(([r, v]) => (
              <div key={r} className="rounded-lg border border-border bg-card p-4 shadow-surface">
                <p className="text-[13px] font-medium text-muted-foreground">{r}</p>
                <p className="font-heading text-[28px] font-bold tabular-nums">{v}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground lg:col-span-4">
              Participação agregada: {adesao.elegiveis ? Math.round((adesao.respostas / adesao.elegiveis) * 100) : 0}% das pessoas elegíveis. O sistema não registra quais pessoas responderam.
            </p>
          </div>
        )}
        {org.resumo?.liberado ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Cartao className="p-5">
              <p className="text-[13px] font-medium text-muted-foreground">Score indicativo geral da pesquisa</p>
              <p className="font-heading text-[40px] leading-tight font-bold tabular-nums">{org.geral ?? "—"}</p>
              {org.geral !== null && <Selo tom={faixaDe(org.geral, c.faixas).tom}>{faixaDe(org.geral, c.faixas).nome}</Selo>}
              <p className="mt-2 text-xs text-muted-foreground">Amostra: {org.resumo.respondentes} resposta(s). Indicativo de percepção — não é avaliação técnica do GRO/PGR.</p>
              <div className="mt-4">
                <RadarFatores fatores={org.fatores} />
              </div>
            </Cartao>
            <Cartao className="p-5">
              <h3 className="mb-3 font-heading font-bold">Scores por fator (0–100, maior = mais exposição)</h3>
              <BarrasFatores fatores={org.fatores} faixas={c.faixas} />
            </Cartao>
          </div>
        ) : (
          <Oculto resumo={org.resumo} />
        )}
        <Metodologia c={c} />
      </div>
    );
  } else if (aba === "departamentos") {
    conteudo = !c.coletarDepartamento ? (
      <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">{MOTIVO_OCULTO.sem_departamento}</p>
    ) : c.status !== "encerrado" ? (
      <Oculto resumo={{ respondentes: null, minimo: 0, liberado: false, motivo: "aberta" }} />
    ) : departamentos.length === 0 ? (
      <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">{escopo === "todos" ? "Nenhum departamento na audiência." : "Nenhuma área sob sua liderança nesta pesquisa."}</p>
    ) : (
      <Cartao aria-labelledby="deps">
        <CabecalhoCartao id="deps" titulo="Comparativo entre departamentos" descricao="Exibido só quando o grupo e o restante da organização têm respostas suficientes. Recortes ocultos não mostram números." />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="border border-border p-2 text-xs">
                  Fator
                </th>
                {departamentos.map((d) => (
                  <th key={d.id} scope="col" className="border border-border p-2 text-center text-xs">
                    {d.nome}
                    {d.resumo?.liberado && <span className="block font-normal text-muted-foreground">amostra {d.resumo.respondentes}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.dimensoes.map((dim) => (
                <tr key={dim.id}>
                  <th scope="row" className="border border-border p-2 text-xs font-medium">
                    {dim.nome}
                  </th>
                  {departamentos.map((d) => {
                    const f = d.fatores.find((x) => x.id === dim.id);
                    if (!d.resumo?.liberado || f?.score === null || f?.score === undefined)
                      return (
                        <td key={d.id} className="border border-border p-2 text-center text-xs text-muted-foreground" title={MOTIVO_OCULTO[d.resumo?.motivo ?? "minimo"] ?? ""}>
                          —
                        </td>
                      );
                    const fx = faixaDe(f.score, c.faixas);
                    return (
                      <td key={d.id} className="border border-border p-2 text-center text-sm font-semibold tabular-nums">
                        {f.score} <span className="block text-[11px] font-normal text-muted-foreground">{fx.nome}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">“—” = dados insuficientes para exibição segura.</p>
        </div>
      </Cartao>
    );
  } else if (aba === "matriz") {
    conteudo = (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <strong>Matriz indicativa da pesquisa.</strong> Cruza a exposição relatada com uma severidade de referência do produto. Não é a matriz de risco oficial da organização até ser revisada e validada
          conforme a metodologia do GRO/PGR.{" "}
          {c.matrizRevisadaEm ? `Última revisão: ${c.matrizRevisadaPor} em ${formatarDataHora(c.matrizRevisadaEm.toISOString())}.` : "Ainda não revisada."}
        </p>
        {organizacao?.resumo?.liberado ? (
          <Cartao className="p-5">
            <MatrizIndicativa fatores={organizacao.fatores} faixas={c.faixas} />
          </Cartao>
        ) : (
          <Oculto resumo={organizacao?.resumo ?? null} />
        )}
        {gestao && (
          <Cartao className="p-5">
            <h3 className="mb-3 font-heading font-bold">Revisar severidade de referência por fator</h3>
            <RevisarMatriz id={c.id} fatores={c.dimensoes.map((d) => ({ id: d.id, nome: d.nome, severidade: d.severidade }))} />
          </Cartao>
        )}
      </div>
    );
  } else if (aba === "evolucao") {
    conteudo = (
      <Cartao className="p-5">
        <h3 className="mb-1 font-heading font-bold">Evolução entre diagnósticos comparáveis</h3>
        <p className="mb-3 text-xs text-muted-foreground">Mesma metodologia ({c.metodologiaVersao}). Compare com cautela quando o tipo de questionário ou a audiência mudarem.</p>
        <Evolucao pontos={evolucao.map((x) => ({ rotulo: formatarData(x.encerradoEm ?? new Date()), valor: x.geral }))} />
      </Cartao>
    );
  } else if (aba === "plano") {
    const sug = c.aiSugestoes as SugestoesNr1 | null;
    conteudo = (
      <div className="flex flex-col gap-4">
        {c.status !== "encerrado" ? (
          <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">O plano de ação é elaborado após o encerramento da pesquisa.</p>
        ) : (
          <>
            <Cartao className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Sparkles className="size-5 text-teal-strong" aria-hidden />
                <p className="flex-1 text-sm text-muted-foreground">
                  {iaDisponivel()
                    ? "A IA recebe apenas os scores agregados que passaram pelas regras de proteção — nunca respostas individuais, nomes ou recortes ocultos. As sugestões ficam em prévia até a sua revisão."
                    : "Sugestões com IA indisponíveis: a integração não está configurada. A análise e o plano manuais continuam disponíveis."}
                </p>
                {gestao && iaDisponivel() && organizacao?.resumo?.liberado && <BotaoNr1 acao="ia" id={c.id} variante="primario" />}
              </div>
              {sug && (
                <div className="flex flex-col gap-3 border-t border-border pt-3 text-sm">
                  <p className="text-xs text-muted-foreground">Sugestões geradas em {c.aiSugestoesEm ? formatarDataHora(c.aiSugestoesEm.toISOString()) : "—"} — apoio à análise, sem validação técnica.</p>
                  <p className="whitespace-pre-line">{sug.resumo_executivo}</p>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div>
                      <p className="font-semibold">Fatores para investigar</p>
                      <ul className="list-disc pl-5">
                        {sug.fatores_investigar.map((f, i) => (
                          <li key={i}>
                            {f.fator}: {f.motivo}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold">Hipóteses a verificar</p>
                      <ul className="list-disc pl-5">
                        {sug.hipoteses.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold">Medidas organizacionais sugeridas</p>
                      <ul className="list-disc pl-5">
                        {sug.medidas.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {gestao && sug.plano_acao.length > 0 && <PreviaSugestoes id={c.id} sugestoes={sug} fatores={fatoresSimples} />}
                </div>
              )}
            </Cartao>
            {gestao && (
              <Cartao className="p-5">
                <h3 className="mb-3 font-heading font-bold">Registrar fator priorizado</h3>
                <NovoRisco cicloId={c.id} fatores={fatoresSimples} />
              </Cartao>
            )}
            {c.riscos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item no plano de ação ainda.</p>}
            {c.riscos.map((r) => (
              <Cartao key={r.id} className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-heading font-bold">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.dimensao?.nome ?? "Geral"} · origem {r.origem === "ia" ? "sugestão de IA revisada" : "humana"} · revisado por {r.revisadoPor ?? "—"}
                      {r.revisadoEm && ` em ${formatarData(r.revisadoEm)}`}
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <Selo tom={PRIORIDADE[r.prioridade].tom}>Prioridade {PRIORIDADE[r.prioridade].nome.toLowerCase()}</Selo>
                    {gestao ? <StatusRisco id={r.id} status={r.status} /> : null}
                  </span>
                </div>
                {r.descricao && <p className="text-sm text-muted-foreground">{r.descricao}</p>}
                <ul className="flex flex-col gap-2">
                  {r.acoes.map((a) => (
                    <li key={a.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{a.titulo}</span>
                        <Selo tom={STATUS_ACAO_NR1[a.status].tom}>{STATUS_ACAO_NR1[a.status].nome}</Selo>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {a.responsavelNome} · prazo {a.prazo ? formatarData(a.prazo) : "—"} · origem {a.origem === "ia" ? "IA (revisada)" : "humana"} · revisado por {a.revisadoPor ?? "—"}
                        {a.evidencia && ` · evidência: ${a.evidencia}`}
                      </p>
                      {gestao && (
                        <div className="mt-2">
                          <AtualizarAcao id={a.id} status={a.status} evidencia={a.evidencia} rotulo={a.titulo} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {gestao && <NovaAcao riscoId={r.id} />}
              </Cartao>
            ))}
          </>
        )}
      </div>
    );
  } else if (aba === "convites") {
    conteudo = (
      <Cartao className="flex flex-col gap-3 p-5 text-sm">
        {adesao && (
          <p className="tabular-nums">
            {adesao.convites} convite(s) criado(s) · {adesao.enviados} enviado(s) · {adesao.falhas} falha(s) · {adesao.respostas} resposta(s) recebida(s)
          </p>
        )}
        <p className="text-muted-foreground">
          Os convites registram só o envio do e-mail. O uso do link fica numa tabela separada que a aplicação não lê: por isso esta tela não mostra quem respondeu, e os lembretes vão apenas para quem ainda
          não respondeu sem que a lista seja exibida.{c.lembreteEm && ` Último lembrete: ${formatarDataHora(c.lembreteEm.toISOString())}.`}
        </p>
        {gestao && c.status === "aberto" && (
          <div className="flex flex-wrap gap-2">
            <BotaoNr1 acao="enviar" id={c.id} />
            <BotaoNr1 acao="lembrete" id={c.id} />
          </div>
        )}
      </Cartao>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/nr1" className="text-sm text-muted-foreground hover:text-foreground">
            ← Diagnóstico NR-1
          </Link>
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-xl font-bold">
            {c.titulo} <Selo tom={STATUS_CICLO[c.status].tom}>{STATUS_CICLO[c.status].nome}</Selo>
          </h2>
          <p className="text-sm text-muted-foreground">
            {c.metodologiaVersao === "legado" ? "Questionário anterior" : `Questionário ${TIPO_DIAGNOSTICO[c.tipo].nome.toLowerCase()}`} · {AUDIENCIA_NR1[c.audienciaTipo as keyof typeof AUDIENCIA_NR1] ?? c.audienciaTipo}
            {c.dataInicio && ` · ${formatarData(c.dataInicio)}`}
            {c.encerraEm && ` – ${formatarData(c.encerraEm)}`} · metodologia {c.metodologiaVersao}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {gestao && c.status === "rascunho" && (
            <>
              <Link href={`/nr1/${c.id}/editar`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                <Pencil className="size-4" aria-hidden /> Editar
              </Link>
              <BotaoNr1 acao="ativar_enviar" id={c.id} variante="primario" />
              <BotaoNr1 acao="ativar" id={c.id} />
              <BotaoNr1 acao="excluir" id={c.id} variante="perigo" />
            </>
          )}
          {gestao && c.status === "aberto" && <BotaoNr1 acao="encerrar" id={c.id} variante="perigo" />}
          {c.status === "encerrado" && pode(ctx, "nr1", "exportar") && (
            <>
              <Link href={`/nr1/${c.id}/relatorio`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                <FileText className="size-4" aria-hidden /> Relatório (PDF)
              </Link>
              <a href={`/nr1/${c.id}/exportar`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                <Download className="size-4" aria-hidden /> CSV
              </a>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{AVISO_NR1}</p>

      {c.status !== "rascunho" && abasVisiveis.length > 1 && (
        <nav aria-label="Seções do diagnóstico" className="max-w-full overflow-x-auto">
          <ul className="flex w-max gap-1 rounded-md border border-border bg-card p-1 shadow-surface">
            {abasVisiveis.map((a) => (
              <li key={a}>
                <Link
                  href={`/nr1/${c.id}?tab=${a}`}
                  aria-current={aba === a ? "page" : undefined}
                  className={cn("inline-flex h-8 items-center rounded-sm px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground", aba === a && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
                >
                  {ABAS[a]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {conteudo}
      <p className="text-xs text-muted-foreground">{LIMITACOES}</p>
    </>
  );
}
