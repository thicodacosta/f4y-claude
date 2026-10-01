import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hojeTexto } from "@/lib/datas";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { uuidOuNada } from "@/lib/validacao";
import { MOTIVOS, nomeMotivo, STATUS_ENTREVISTA, TIPO_DESLIGAMENTO, type Motivo } from "@/lib/offboarding/motivos";
import { CHAVES_DIMENSAO, DESTINOS, DIMENSOES, ESCALA, lerRespostas, SIM_TALVEZ_NAO } from "@/lib/offboarding/questionario";
import { CabecalhoCartao, Cartao } from "@/components/app/painel";
import { Selo } from "@/components/app/lista";
import { FormDesligamento } from "@/components/offboarding/form-desligamento";
import { AcoesEntrevista } from "@/components/offboarding/acoes-entrevista";

export const metadata: Metadata = { title: "Desligamento" };

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr]">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function DesligamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, db } = await exigirModulo("offboarding");
  const r = uuidOuNada(id) ? await db.desligamento.findUnique({ where: { id }, include: { colaborador: { select: { id: true, nome: true, email: true } } } }) : null;
  if (!r) notFound();
  const podeEditar = !!pode(ctx, "offboarding", "editar") && !ctx.suporte;
  const resp = lerRespostas(r.respostas);
  const st = STATUS_ENTREVISTA[r.entrevistaStatus as keyof typeof STATUS_ENTREVISTA];
  const expirada = r.entrevistaStatus === "enviada" && r.entrevistaExpiraEm && r.entrevistaExpiraEm < new Date();
  const principal = (r.motivoPrincipalReal ?? r.motivoDeclarado) as Motivo;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/offboarding" className="text-sm text-muted-foreground hover:text-foreground">
          ← Desligamentos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">{r.colaborador.nome}</h1>
          <Selo tom={r.voluntario ? "alerta" : "neutro"}>{r.voluntario ? "Saída voluntária" : "Saída involuntária"}</Selo>
          {r.perdaLamentada && <Selo tom="perigo">Perda lamentada</Selo>}
          {st && <Selo tom={expirada ? "perigo" : st.tom}>{expirada ? "Link expirado" : st.nome}</Selo>}
        </div>
        <p className="text-sm text-muted-foreground">
          {TIPO_DESLIGAMENTO[r.tipo].nome} em {formatarData(r.data)} · {[r.cargo, r.equipeNome, r.areaNome].filter(Boolean).join(" · ") || "sem cargo/equipe"}
          {r.gestorNome && ` · gestor: ${r.gestorNome}`}
          {r.admissao && ` · admissão em ${formatarData(r.admissao)}`}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Confidencial: visível apenas para RH/Admin. Não compartilhe as respostas individuais com a liderança direta.
        </p>
      </div>

      <Cartao>
        <CabecalhoCartao titulo="Entrevista de desligamento" descricao="Entenda os motivos reais da saída — quanto mais perto do desligamento, mais fiel o relato." />
        <div className="flex flex-col gap-4 px-5 pb-5">
          {r.entrevistaStatus === "respondida" && resp ? (
            <>
              <p className="text-xs text-muted-foreground">
                {r.entrevistaModo === "conduzida" ? "Registrada pelo RH a partir de conversa" : "Respondida pela pessoa pelo link"}
                {r.entrevistaRespondidaEm && ` em ${formatarDataHora(r.entrevistaRespondidaEm.toISOString())}`}.
              </p>
              <dl className="divide-y divide-border">
                <Linha rotulo="Motivo principal">
                  <strong>{nomeMotivo(resp.motivoPrincipal)}</strong>
                  {resp.motivoPrincipal !== r.motivoDeclarado && <span className="ml-2 text-xs text-warning-foreground dark:text-warning">difere do motivo informado ({nomeMotivo(r.motivoDeclarado)})</span>}
                </Linha>
                <Linha rotulo="Todos os motivos">{resp.motivos.map(nomeMotivo).join(" · ")}</Linha>
                {resp.decisao && <Linha rotulo="O que mais pesou">{resp.decisao}</Linha>}
                <Linha rotulo="Poderia ter sido evitada?">
                  {SIM_TALVEZ_NAO[resp.evitavel]}
                  {resp.oQueEvitaria && <span className="block text-muted-foreground">{resp.oQueEvitaria}</span>}
                </Linha>
                <Linha rotulo="Recomendaria a empresa (0–10)">
                  <strong>{resp.enps}</strong> <span className="text-muted-foreground">({resp.enps >= 9 ? "promotor" : resp.enps >= 7 ? "neutro" : "detrator"})</span>
                </Linha>
                <Linha rotulo="Voltaria a trabalhar aqui">{SIM_TALVEZ_NAO[resp.voltaria]}</Linha>
                {resp.destino && <Linha rotulo="Próximo passo">{DESTINOS[resp.destino]}</Linha>}
                {resp.sugestoes && <Linha rotulo="Sugestões">{resp.sugestoes}</Linha>}
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Experiência na empresa</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {CHAVES_DIMENSAO.map((dm) => {
                    const v = resp.experiencia[dm];
                    return (
                      <li key={dm} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                        <span>{DIMENSOES[dm]}</span>
                        <span className={v !== undefined && v <= 2 ? "font-semibold text-destructive" : "font-semibold"} title={v ? ESCALA[v - 1] : undefined}>
                          {v ?? "—"}/5
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : r.entrevistaStatus === "dispensada" ? (
            <p className="text-sm text-muted-foreground">Entrevista marcada como não realizada (o motivo está na auditoria).</p>
          ) : (
            <>
              {r.entrevistaStatus === "enviada" && (
                <p className="text-sm">
                  Link enviado para <strong>{r.emailContato}</strong>
                  {r.entrevistaEnviadaEm && ` em ${formatarDataHora(r.entrevistaEnviadaEm.toISOString())}`}
                  {r.entrevistaExpiraEm && ` · ${expirada ? "expirou" : "vale até"} ${formatarData(r.entrevistaExpiraEm)}`}.
                </p>
              )}
              {r.entrevistaErro && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Último envio falhou: {r.entrevistaErro}
                </p>
              )}
              {podeEditar ? (
                <AcoesEntrevista id={r.id} emailSugerido={r.emailContato ?? r.colaborador.email ?? ""} jaEnviada={r.entrevistaStatus === "enviada"} />
              ) : (
                <p className="text-sm text-muted-foreground">Entrevista ainda não respondida.</p>
              )}
            </>
          )}
        </div>
      </Cartao>

      {ctx.modulos.has("retencao") && pode(ctx, "retencao", "criar") === "todos" && !ctx.suporte && (
        <Cartao className="bg-brand-gradient-soft">
          <CabecalhoCartao titulo={`Aprender com esta saída: ${MOTIVOS[principal].nome}`} descricao="Ações que reduzem saídas por este fator para quem fica." />
          <div className="flex flex-col gap-3 px-5 pb-5">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {MOTIVOS[principal].acoes.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <Link href={`/retencao/acoes?nova=1&categoria=${principal}&origem=offboarding${r.equipeId ? `&equipe=${r.equipeId}` : ""}#nova-acao`} className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Criar ação de retenção
            </Link>
          </div>
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao titulo="Registro do desligamento" descricao={`Registrado por ${r.registradoPor} em ${formatarDataHora(r.criadoEm.toISOString())}.`} />
        <div className="px-5 pb-5">
          <FormDesligamento
            id={r.id}
            hoje={hojeTexto()}
            somenteLeitura={!podeEditar}
            inicial={{
              tipo: r.tipo,
              voluntario: r.voluntario,
              motivoDeclarado: (r.motivoDeclarado in MOTIVOS ? r.motivoDeclarado : "outro") as Motivo,
              observacao: r.observacao ?? "",
              perdaLamentada: r.perdaLamentada,
              elegivelRecontratacao: r.elegivelRecontratacao === null ? "" : r.elegivelRecontratacao ? "sim" : "nao",
              emailContato: r.emailContato ?? "",
            }}
          />
        </div>
      </Cartao>
    </>
  );
}
