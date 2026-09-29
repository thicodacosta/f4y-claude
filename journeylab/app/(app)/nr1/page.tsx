import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { equipesLideradas } from "@/lib/pulse/regras";
import { AVISO_NR1, filtroCiclos, filtroCiclosParaResponder, STATUS_CICLO } from "@/lib/nr1/regras";
import { criarCiclo } from "@/lib/nr1/actions";
import { formatarData } from "@/lib/formato";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao, ItemAtividade } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Diagnóstico NR-1" };

export default async function Nr1Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const sp = await searchParams;
  const escopo = pode(ctx, "nr1", "visualizar");

  const eu = ctx.colaboradorId ? await db.colaborador.findUnique({ where: { id: ctx.colaboradorId }, select: { id: true, equipeId: true, status: true } }) : null;
  const paraResponder = eu?.status === "ativo" && !ctx.suporte ? await db.cicloNr1.findMany({ where: filtroCiclosParaResponder(eu.id, eu.equipeId), take: 10 }) : [];
  const minhas = escopo === "equipe" ? (await equipesLideradas(ctx)).map((e) => e.id) : [];
  const ciclos = escopo
    ? await db.cicloNr1.findMany({
        where: filtroCiclos(escopo, minhas),
        include: { _count: { select: { perguntas: true, dimensoes: true, riscos: true } } },
        orderBy: { criadoEm: "desc" },
        take: 50,
      })
    : [];
  const podeCriar = pode(ctx, "nr1", "criar") === "todos" && !ctx.suporte;

  return (
    <>
      {sp.respondido && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> Participação registrada de forma anônima. Obrigado!
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao aria-labelledby="participar">
            <CabecalhoCartao id="participar" titulo="Para participar" descricao="Ciclos abertos dos quais você faz parte." />
            <div className="px-3 pb-3">
              {paraResponder.length === 0 ? (
                <p className="px-2 pb-3 text-sm text-muted-foreground">Nenhum ciclo pendente para você.</p>
              ) : (
                <ul>
                  {paraResponder.map((c) => (
                    <ItemAtividade key={c.id} href={`/nr1/responder/${c.id}`} icone={ShieldCheck} titulo={c.titulo} subtitulo="Anônimo · cerca de 5 minutos" valor={c.encerraEm ? `Até ${formatarData(c.encerraEm)}` : "Participar"} />
                  ))}
                </ul>
              )}
            </div>
          </Cartao>

          {escopo && (
            <section aria-labelledby="ciclos" className="flex flex-col gap-3">
              <h2 id="ciclos" className="font-heading text-lg font-bold">
                Ciclos de diagnóstico
              </h2>
              {ciclos.length === 0 ? (
                <EstadoVazio titulo="Nenhum ciclo" descricao={podeCriar ? "Crie um ciclo a partir do questionário de referência e adapte-o com a sua equipe de SST." : "Não há ciclos visíveis para você."} />
              ) : (
                <Tabela colunas={["Ciclo", "Público", "Estrutura", "Situação", "Riscos"]} minWidth={700}>
                  {ciclos.map((c) => (
                    <tr key={c.id}>
                      <Celula>
                        <Link href={`/nr1/${c.id}`} className="font-medium hover:text-teal-strong">
                          {c.titulo}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {c.encerradoEm ? `Encerrado em ${formatarData(c.encerradoEm)}` : c.encerraEm ? `Encerramento previsto ${formatarData(c.encerraEm)}` : `Criado por ${c.criadoPor}`}
                        </span>
                      </Celula>
                      <Celula className="text-muted-foreground">{c.publicoTodos ? "Toda a organização" : `${c.equipeIds.length} equipe(s)`}</Celula>
                      <Celula className="text-muted-foreground">
                        {c._count.dimensoes} dimensões · {c._count.perguntas} perguntas
                      </Celula>
                      <Celula>
                        <Selo tom={STATUS_CICLO[c.status].tom}>{STATUS_CICLO[c.status].nome}</Selo>
                      </Celula>
                      <Celula className="tabular-nums text-muted-foreground">{c._count.riscos || "—"}</Celula>
                    </tr>
                  ))}
                </Tabela>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {podeCriar && (
            <Cartao aria-labelledby="novo">
              <CabecalhoCartao id="novo" titulo="Novo ciclo" descricao="Nasce como rascunho; o questionário fica fixo ao abrir." />
              <div className="px-5 pb-5">
                <FormAcao action={criarCiclo} textoBotao="Criar rascunho">
                  <Campo nome="titulo" rotulo="Título" required placeholder="Ex.: Diagnóstico psicossocial 2026" />
                  <Selecao
                    nome="modelo"
                    rotulo="Questionário"
                    opcoes={[
                      { valor: "referencia", rotulo: "Referência JourneyLab (7 dimensões, 21 perguntas)" },
                      { valor: "branco", rotulo: "Em branco" },
                    ]}
                  />
                </FormAcao>
              </div>
            </Cartao>
          )}
          <Cartao className="bg-brand-gradient-soft p-5">
            <p className="flex items-center gap-2 font-heading font-bold">
              <Info className="size-4 text-teal-strong" aria-hidden /> Sobre este diagnóstico
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{AVISO_NR1}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Respostas anônimas; resultados só após o encerramento e com no mínimo <strong className="text-foreground">{ctx.org.minimoRecorte}</strong> participantes por recorte.
            </p>
          </Cartao>
        </div>
      </div>
    </>
  );
}
