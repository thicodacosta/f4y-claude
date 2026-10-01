import Link from "next/link";
import type { Metadata } from "next";
import { AlarmClock, Briefcase, Clock, Plus, Users } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroVagas } from "@/lib/crm/consultas";
import { hoje, somarDias } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { uuidOuNada, valorPermitido } from "@/lib/validacao";
import { PRIORIDADES, type EtapaPipeline, type Prioridade } from "@/lib/crm/pipeline";
import { STATUS_CANDIDATURA } from "@/lib/crm/normalizar";
import type { Prisma } from "@/lib/generated/prisma/client";
import { BarraBusca, FiltroSelect } from "@/components/app/lista";
import { Indicador } from "@/components/analytics/graficos";
import { PipelineVagas, type CartaoVaga } from "@/components/crm/pipeline-vagas";

export const metadata: Metadata = { title: "Pipeline de Vagas" };

const CONCLUIDAS = { "30": "Últimos 30 dias", "90": "Últimos 90 dias", "365": "Últimos 12 meses" } as const;
const ORDEM_AVANCO = ["aprovado", "entrevista", "em_avaliacao", "inscrito"] as const;

export default async function PipelineVagasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("crm");
  const sp = await searchParams;
  const h = hoje();
  const janela = Number(valorPermitido(sp.concluidas, CONCLUIDAS) ?? "30");
  const prioridade = valorPermitido(sp.prioridade, PRIORIDADES);
  const equipe = uuidOuNada(sp.equipe);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const where: Prisma.VagaWhereInput = {
    AND: [
      filtroVagas(ctx, escopo),
      // Em andamento + concluídas recentes (a coluna "Concluída" não cresce sem limite).
      { OR: [{ status: { in: ["aberta", "pausada"] } }, { fechadaEm: { gte: somarDias(h, -janela) } }] },
      prioridade ? { prioridade } : {},
      equipe ? { equipeId: equipe } : {},
      q ? { titulo: { contains: q, mode: "insensitive" } } : {},
    ],
  };
  const [vagas, equipes] = await Promise.all([
    db.vaga.findMany({
      where,
      include: {
        equipe: { select: { nome: true } },
        gestor: { select: { nome: true } },
        candidaturas: { select: { status: true, atualizadoEm: true, candidato: { select: { id: true, nome: true } } } },
      },
      orderBy: { abertaEm: "asc" },
      take: 300,
    }),
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  const cartoes: CartaoVaga[] = vagas.map((v) => {
    const conta = (s: string) => v.candidaturas.filter((c) => c.status === s).length;
    const destaques = [...v.candidaturas]
      .filter((c) => (ORDEM_AVANCO as readonly string[]).includes(c.status))
      .sort((a, b) => ORDEM_AVANCO.indexOf(a.status as (typeof ORDEM_AVANCO)[number]) - ORDEM_AVANCO.indexOf(b.status as (typeof ORDEM_AVANCO)[number]) || b.atualizadoEm.getTime() - a.atualizadoEm.getTime())
      .slice(0, 3)
      .map((c) => ({ candidatoId: c.candidato.id, nome: c.candidato.nome, etapa: STATUS_CANDIDATURA[c.status].nome }));
    const fim = v.fechadaEm ?? new Date();
    return {
      id: v.id,
      titulo: v.titulo,
      etapa: v.etapaPipeline as EtapaPipeline,
      prioridade: (v.prioridade in PRIORIDADES ? v.prioridade : "media") as Prioridade,
      publicada: v.publicada,
      pausada: v.status === "pausada",
      equipe: v.equipe?.nome ?? null,
      gestor: v.gestor?.nome ?? null,
      diasAberta: Math.max(0, Math.round((fim.getTime() - v.abertaEm.getTime()) / 86_400_000)),
      prazo: v.prazoFechamento ? formatarData(v.prazoFechamento) : null,
      prazoVencido: !!v.prazoFechamento && v.prazoFechamento < h,
      posicoes: v.posicoes,
      contratados: conta("contratado"),
      funil: { inscrito: conta("inscrito"), avaliacao: conta("em_avaliacao"), entrevista: conta("entrevista"), aprovado: conta("aprovado") },
      destaques,
    };
  });
  const ativas = cartoes.filter((c) => c.etapa !== "concluida");
  const emProcesso = ativas.reduce((n, c) => n + c.funil.inscrito + c.funil.avaliacao + c.funil.entrevista + c.funil.aprovado, 0);
  const posicoes = ativas.reduce((n, c) => n + Math.max(0, c.posicoes - c.contratados), 0);
  const vencidas = ativas.filter((c) => c.prazoVencido).length;
  const mediaDias = ativas.length ? Math.round(ativas.reduce((n, c) => n + c.diasAberta, 0) / ativas.length) : 0;
  const podeMover = pode(ctx, "crm", "editar") !== null && !ctx.suporte;

  return (
    <>
      <section aria-label="Resumo do pipeline" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Vagas em andamento" valor={String(ativas.length)} icone={Briefcase} detalhe={`${posicoes} posição(ões) a preencher`} />
        <Indicador rotulo="Candidatos em processo" valor={String(emProcesso)} icone={Users} detalhe="Inscritos, em avaliação, entrevista ou aprovados" href="/crm?visao=kanban" />
        <Indicador rotulo="Prazo vencido" valor={String(vencidas)} icone={AlarmClock} alerta={vencidas > 0} detalhe={vencidas ? "Vagas abertas além do prazo combinado" : "Todas dentro do prazo"} />
        <Indicador rotulo="Tempo médio em aberto" valor={`${mediaDias} d`} icone={Clock} detalhe="Desde a abertura da vaga" />
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <BarraBusca q={sp.q} placeholder="Título da vaga">
            <FiltroSelect nome="prioridade" rotulo="Prioridade" valor={prioridade} opcoes={Object.entries(PRIORIDADES).map(([valor, p]) => ({ valor, rotulo: p.nome }))} />
            <FiltroSelect nome="equipe" rotulo="Equipe" valor={equipe} opcoes={equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
            <FiltroSelect nome="concluidas" rotulo="Concluídas" valor={String(janela)} opcoes={Object.entries(CONCLUIDAS).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          </BarraBusca>
        </div>
        {pode(ctx, "crm", "criar") && !ctx.suporte && (
          <Link href="/pagina-carreiras/nova" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" aria-hidden /> Nova vaga
          </Link>
        )}
      </div>
      <PipelineVagas cartoes={cartoes} podeMover={podeMover} />
      <p className="text-xs text-muted-foreground">
        Mover para “Concluída” encerra a vaga e a retira da Página de Carreiras; tirar de “Concluída” a reabre sem publicar. A etapa de cada candidato fica no{" "}
        <Link href="/crm?visao=kanban" className="font-medium text-teal-strong hover:underline">
          Kanban do CRM
        </Link>
        .
      </p>
    </>
  );
}
