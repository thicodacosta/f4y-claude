import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { exigirModulo } from "@/lib/contexto";
import { adicionarEtapa, adicionarTarefaModelo, excluirEtapa, excluirTarefaModelo, salvarModelo } from "@/lib/onboarding/actions";
import { RESPONSAVEL, TIPO_TAREFA } from "@/lib/onboarding/regras";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, BotaoAcao, Campo, Interruptor, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Modelo de onboarding" };

export default async function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await exigirModulo("onboarding", "editar");
  if (r.escopo !== "todos") redirect("/onboarding");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const m = await r.db.modeloOnboarding.findUnique({
    where: { id },
    include: { etapas: { orderBy: { ordem: "asc" }, include: { tarefas: { orderBy: { ordem: "asc" } } } } },
  });
  if (!m) notFound();

  return (
    <>
      <div>
        <Link href="/onboarding/modelos" className="text-sm text-muted-foreground hover:text-foreground">← Modelos</Link>
        <h2 className="mt-2 font-heading text-2xl font-bold">{m.nome}</h2>
        <p className="text-sm text-muted-foreground">
          Alterações no modelo valem para os próximos onboardings; os que já estão em andamento mantêm suas tarefas.
        </p>
      </div>

      <FormAcao action={salvarModelo} textoBotao="Salvar modelo" className="rounded-lg border border-border bg-card p-5">
        <input type="hidden" name="id" value={m.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <Campo nome="nome" rotulo="Nome" defaultValue={m.nome} required />
          <Campo nome="descricao" rotulo="Descrição" defaultValue={m.descricao ?? ""} />
          <Area nome="boasVindas" rotulo="Mensagem de boas-vindas" defaultValue={m.boasVindas ?? ""} rows={3} className="md:col-span-2" />
          <Interruptor nome="ativo" rotulo="Modelo ativo" marcado={m.ativo} ajuda="Inativo não aparece para novos onboardings." />
        </div>
      </FormAcao>

      <section className="flex flex-col gap-4">
        <h3 className="font-heading text-lg font-bold">Etapas e tarefas</h3>
        {m.etapas.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="font-semibold">{e.titulo}</p>
              <form action={excluirEtapa.bind(null, e.id)}>
                <BotaoAcao variante="perigo"><Trash2 className="size-4" aria-hidden /> Excluir etapa</BotaoAcao>
              </form>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {e.tarefas.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_TAREFA[t.tipo]} · {RESPONSAVEL[t.responsavel]} · {t.prazoDias === 0 ? "no dia do início" : t.prazoDias > 0 ? `${t.prazoDias} dias após o início` : `${-t.prazoDias} dias antes do início`}
                      {t.materialUrl && " · com link"}
                    </p>
                  </div>
                  <form action={excluirTarefaModelo.bind(null, t.id)}>
                    <button type="submit" aria-label={`Excluir ${t.titulo}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={adicionarTarefaModelo.bind(null, e.id)} className="grid gap-3 border-t border-border bg-muted/40 p-4 md:grid-cols-6">
              <Campo nome="titulo" rotulo="Nova tarefa" required className="md:col-span-2" />
              <Selecao nome="tipo" rotulo="Tipo" opcoes={Object.entries(TIPO_TAREFA).map(([valor, rotulo]) => ({ valor, rotulo }))} />
              <Selecao nome="responsavel" rotulo="Responsável" opcoes={Object.entries(RESPONSAVEL).map(([valor, rotulo]) => ({ valor, rotulo }))} />
              <Campo nome="prazoDias" rotulo="Prazo (dias)" type="number" defaultValue={0} ajuda="Negativo = antes do início." />
              <Campo nome="materialUrl" rotulo="Link (opcional)" type="url" placeholder="https://" />
              <Campo nome="descricao" rotulo="Orientação" className="md:col-span-5" />
              <div className="flex items-end">
                <BotaoAcao variante="primario"><Plus className="size-4" aria-hidden /> Adicionar</BotaoAcao>
              </div>
            </form>
          </div>
        ))}
        <form action={adicionarEtapa.bind(null, m.id)} className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
          <Campo nome="titulo" rotulo="Nova etapa" required placeholder="Ex.: Antes da chegada, Primeira semana, 30 dias" className="flex-1" />
          <BotaoAcao variante="primario"><Plus className="size-4" aria-hidden /> Adicionar etapa</BotaoAcao>
        </form>
      </section>
    </>
  );
}
