import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { adicionarEtapa, adicionarTarefaModelo, excluirEtapa, excluirTarefaModelo, salvarEtapa, salvarModelo } from "@/lib/onboarding/actions";
import { RESPONSAVEL, TIPO_TAREFA } from "@/lib/onboarding/calculo";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Interruptor, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Template de onboarding" };

function prazoRotulo(prazoDias: number | null, marco: number) {
  if (prazoDias === null) return `até o dia ${marco} (marco da fase)`;
  if (prazoDias === 0) return "no dia do início";
  return prazoDias > 0 ? `${prazoDias} dias após o início` : `${-prazoDias} dias antes do início`;
}

export default async function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("onboarding", "editar");
  if (escopo !== "todos") redirect("/onboarding");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [m, areas] = await Promise.all([
    db.modeloOnboarding.findUnique({ where: { id }, include: { etapas: { orderBy: { ordem: "asc" }, include: { tarefas: { orderBy: { ordem: "asc" } } } } } }),
    db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!m) notFound();
  const edita = !ctx.suporte;

  return (
    <>
      <div>
        <Link href="/onboarding/modelos" className="text-sm text-muted-foreground hover:text-foreground">
          ← Templates
        </Link>
        <h2 className="mt-2 font-heading text-2xl font-bold">{m.nome}</h2>
        <p className="text-sm text-muted-foreground">Alterações valem para os próximos onboardings; os já criados mantêm suas fases e tarefas.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          {m.etapas.map((e, i) => (
            <Cartao key={e.id} aria-label={`Fase ${i + 1}: ${e.titulo}`}>
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Fase {i + 1}</p>
                  <p className="font-heading font-bold">{e.titulo}</p>
                  <p className="text-xs text-muted-foreground">{e.descricao ?? `Até o dia ${e.marcoDias}`} · marco no dia {e.marcoDias}</p>
                </div>
                {edita && (
                  <form action={excluirEtapa.bind(null, e.id)}>
                    <button type="submit" aria-label={`Excluir fase ${e.titulo}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-border border-t border-border">
                {e.tarefas.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {t.titulo}
                        {!t.obrigatoria && <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {RESPONSAVEL[t.responsavel]} · {TIPO_TAREFA[t.tipo]} · {prazoRotulo(t.prazoDias, e.marcoDias)}
                        {t.materialUrl && " · com link"}
                      </p>
                    </div>
                    {edita && (
                      <form action={excluirTarefaModelo.bind(null, t.id)}>
                        <button type="submit" aria-label={`Excluir ${t.titulo}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
                {e.tarefas.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Sem tarefas.</li>}
              </ul>
              {edita && (
                <div className="grid gap-4 border-t border-border px-5 py-4 lg:grid-cols-2">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-teal-strong">+ Incluir tarefa</summary>
                    <FormAcao action={adicionarTarefaModelo} textoBotao="Incluir tarefa" limparAoConcluir className="mt-3">
                      <input type="hidden" name="etapaId" value={e.id} />
                      <Campo nome="titulo" idCampo={`titulo-${e.id}`} rotulo="Tarefa" required />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Selecao nome="responsavel" idCampo={`resp-${e.id}`} rotulo="Responsável" opcoes={Object.entries(RESPONSAVEL).map(([valor, rotulo]) => ({ valor, rotulo }))} />
                        <Selecao nome="tipo" idCampo={`tipo-${e.id}`} rotulo="Tipo" opcoes={Object.entries(TIPO_TAREFA).map(([valor, rotulo]) => ({ valor, rotulo }))} />
                        <Campo nome="prazoDias" idCampo={`prazo-${e.id}`} rotulo="Prazo (dias após o início)" type="number" ajuda={`Vazio = marco da fase (dia ${e.marcoDias}).`} />
                        <Campo nome="materialUrl" idCampo={`url-${e.id}`} rotulo="Link de apoio" type="url" placeholder="https://" />
                      </div>
                      <Campo nome="descricao" idCampo={`desc-${e.id}`} rotulo="Orientação" />
                      <Interruptor nome="obrigatoria" rotulo="Obrigatória" marcado ajuda="O onboarding conclui quando todas as obrigatórias estão concluídas." />
                    </FormAcao>
                  </details>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Editar fase…</summary>
                    <FormAcao action={salvarEtapa} textoBotao="Salvar fase" variante="outline" className="mt-3">
                      <input type="hidden" name="etapaId" value={e.id} />
                      <Campo nome="titulo" idCampo={`fase-${e.id}`} rotulo="Nome" defaultValue={e.titulo} required />
                      <Campo nome="descricao" idCampo={`fdesc-${e.id}`} rotulo="Descrição" defaultValue={e.descricao ?? ""} />
                      <Campo nome="marcoDias" idCampo={`marco-${e.id}`} rotulo="Marco (dia)" type="number" min={1} defaultValue={e.marcoDias} required />
                    </FormAcao>
                  </details>
                </div>
              )}
            </Cartao>
          ))}
          {edita && (
            <Cartao aria-labelledby="nova-fase">
              <CabecalhoCartao id="nova-fase" titulo="Nova fase" />
              <div className="px-5 pb-5">
                <FormAcao action={adicionarEtapa} textoBotao="Incluir fase" limparAoConcluir>
                  <input type="hidden" name="modeloId" value={m.id} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
                    <Campo nome="titulo" idCampo="nova-fase-titulo" rotulo="Nome" required placeholder="Ex.: Consolidação" />
                    <Campo nome="descricao" idCampo="nova-fase-desc" rotulo="Descrição" placeholder="Ex.: Até o dia 90" />
                    <Campo nome="marcoDias" idCampo="nova-fase-marco" rotulo="Marco (dia)" type="number" min={1} defaultValue={30} required />
                  </div>
                </FormAcao>
              </div>
            </Cartao>
          )}
        </div>

        {edita && (
          <Cartao aria-labelledby="config" className="h-fit">
            <CabecalhoCartao id="config" titulo="Configuração" />
            <div className="px-5 pb-5">
              <FormAcao action={salvarModelo} textoBotao="Salvar template">
                <input type="hidden" name="id" value={m.id} />
                <Campo nome="nome" rotulo="Nome" defaultValue={m.nome} required />
                <Campo nome="descricao" rotulo="Descrição" defaultValue={m.descricao ?? ""} />
                <Area nome="boasVindas" rotulo="Mensagem de boas-vindas" defaultValue={m.boasVindas ?? ""} rows={3} />
                <Selecao
                  nome="areaId"
                  rotulo="Aplicar automaticamente à área"
                  defaultValue={m.areaId ?? ""}
                  opcoes={[{ valor: "", rotulo: "Nenhuma" }, ...areas.map((a) => ({ valor: a.id, rotulo: a.nome }))]}
                />
                <Interruptor nome="padrao" rotulo="Template padrão da organização" marcado={m.padrao} />
                <Interruptor nome="ativo" rotulo="Ativo" marcado={m.ativo} ajuda="Inativo não é usado em novos onboardings." />
              </FormAcao>
            </div>
          </Cartao>
        )}
      </div>
    </>
  );
}
