import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo } from "@/lib/contexto";
import { criarModeloPadrao, salvarModelo } from "@/lib/onboarding/actions";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Interruptor, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Templates de onboarding" };

export default async function ModelosPage() {
  const { ctx, escopo, db } = await exigirModulo("onboarding", "editar");
  if (escopo !== "todos") redirect("/onboarding");
  const [modelos, areas] = await Promise.all([
    db.modeloOnboarding.findMany({
      include: { area: { select: { nome: true } }, _count: { select: { etapas: true, onboardings: true } }, etapas: { select: { _count: { select: { tarefas: true } } } } },
      orderBy: [{ padrao: "desc" }, { nome: "asc" }],
    }),
    db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const temPadrao = modelos.some((m) => m.padrao);
  const somenteLeitura = !!ctx.suporte;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
      <section aria-labelledby="templates" className="flex min-w-0 flex-col gap-3">
        <h2 id="templates" className="font-heading text-lg font-bold">
          Templates
        </h2>
        {!temPadrao && !somenteLeitura && (
          <Cartao className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Sem template padrão</p>
              <p className="text-sm text-muted-foreground">Crie o modelo 30/60/90 editável — usado quando a área da pessoa não tem template próprio.</p>
            </div>
            <FormAcao action={criarModeloPadrao} textoBotao="Criar template 30/60/90">
              <input type="hidden" name="modelo" value="30-60-90" />
            </FormAcao>
          </Cartao>
        )}
        {modelos.length === 0 ? (
          <EstadoVazio titulo="Nenhum template" descricao="Crie o template padrão 30/60/90 ou um template em branco." />
        ) : (
          <Tabela colunas={["Template", "Aplicação", "Fases", "Tarefas", "Usos", "Situação"]} minWidth={720}>
            {modelos.map((m) => (
              <tr key={m.id}>
                <Celula>
                  <Link href={`/onboarding/modelos/${m.id}`} className="font-medium hover:text-teal-strong">
                    {m.nome}
                  </Link>
                  {m.descricao && <span className="block text-xs text-muted-foreground">{m.descricao}</span>}
                </Celula>
                <Celula>{m.padrao ? <Selo tom="info">Padrão da organização</Selo> : m.area ? <Selo>Área: {m.area.nome}</Selo> : <span className="text-muted-foreground">Manual</span>}</Celula>
                <Celula className="tabular-nums">{m._count.etapas}</Celula>
                <Celula className="tabular-nums">{m.etapas.reduce((s, e) => s + e._count.tarefas, 0)}</Celula>
                <Celula className="tabular-nums">{m._count.onboardings}</Celula>
                <Celula>
                  <Selo tom={m.ativo ? "sucesso" : "neutro"}>{m.ativo ? "Ativo" : "Inativo"}</Selo>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </section>

      {!somenteLeitura && (
        <Cartao aria-labelledby="novo" className="h-fit">
          <CabecalhoCartao id="novo" titulo="Novo template" descricao="Em branco — depois inclua fases e tarefas." />
          <div className="px-5 pb-5">
            <FormAcao action={salvarModelo} textoBotao="Criar template">
              <Campo nome="nome" rotulo="Nome" required placeholder="Ex.: Onboarding — Tecnologia" />
              <Campo nome="descricao" rotulo="Descrição" />
              <Selecao
                nome="areaId"
                rotulo="Aplicar automaticamente à área"
                ajuda="Pessoas desta área recebem este template no cadastro."
                opcoes={[{ valor: "", rotulo: "Nenhuma (uso manual)" }, ...areas.map((a) => ({ valor: a.id, rotulo: a.nome }))]}
              />
              <Interruptor nome="padrao" rotulo="Template padrão da organização" ajuda="Substitui o padrão atual. Deixe a área em branco." />
            </FormAcao>
          </div>
        </Cartao>
      )}
    </div>
  );
}
