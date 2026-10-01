import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Clock, FileUp, Plus, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { dbTenant } from "@/lib/db";
import { exigirContexto, filtroColaboradores, pode } from "@/lib/contexto";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatarData } from "@/lib/formato";
import { hoje, somarDias } from "@/lib/datas";
import { SEMAFORO } from "@/lib/feedback/avaliacao";
import { calcularPdi, STATUS_PDI } from "@/lib/pdi/calculo";
import { COM_ACOES } from "@/lib/pdi/regras";
import { CabecalhoPagina } from "@/components/secao";
import { Celula, Tabela } from "@/components/app/tabela";
import { LinkExportar } from "@/components/app/painel";
import { BarraBusca, EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo, Iniciais } from "@/components/app/lista";
import { Indicador } from "@/components/analytics/graficos";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_PESSOA } from "@/lib/rotulos";
import { uuidOuNada, valorPermitido } from "@/lib/validacao";

export const metadata: Metadata = { title: "Colaboradores" };

const casa = (adm: Date | null, h: Date) => {
  if (!adm) return null;
  const m = Math.max(0, Math.round((h.getTime() - adm.getTime()) / (30.4375 * 86_400_000)));
  return m >= 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m}m`;
};

/**
 * Base de colaboradores da empresa: cadastro único usado por todos os módulos.
 * Os sinais da jornada (onboarding, feedback, PDI) só aparecem se o módulo
 * estiver ativo e o papel puder ver aquele dado.
 */
export default async function ColaboradoresPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "cadastro", "visualizar");
  if (!escopo || escopo === "proprio") redirect("/conta");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const h = hoje();
  const area = uuidOuNada(sp.area);

  const base = filtroColaboradores(ctx, escopo);
  const where: Prisma.ColaboradorWhereInput = {
    AND: [
      base,
      sp.q ? { OR: [{ nome: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { cargo: { contains: sp.q, mode: "insensitive" } }] } : {},
      valorPermitido(sp.status, STATUS_PESSOA) ? { status: valorPermitido(sp.status, STATUS_PESSOA) } : {},
      uuidOuNada(sp.equipe) ? { equipeId: uuidOuNada(sp.equipe) } : {},
      area ? { equipe: { areaId: area } } : {},
    ],
  };
  const fb = !!pode(ctx, "feedback", "visualizar");
  const pdi = !!pode(ctx, "pdi", "visualizar");
  const onb = !!pode(ctx, "onboarding", "visualizar");
  const [total, pessoas, equipes, areas, resumo] = await Promise.all([
    db.colaborador.count({ where }),
    db.colaborador.findMany({
      where,
      include: {
        equipe: { select: { nome: true, area: { select: { nome: true } } } },
        gestor: { select: { nome: true } },
        associacao: { select: { id: true } },
        ...(fb ? { avaliacoesRecebidas: { orderBy: [{ data: "desc" as const }, { criadoEm: "desc" as const }], take: 1, select: { data: true, semaforo: true } } } : {}),
        ...(pdi ? { pdis: { include: COM_ACOES, orderBy: { criadoEm: "desc" as const }, take: 2 } } : {}),
        ...(onb ? { onboardings: { where: { status: "em_andamento" as const }, select: { id: true, progresso: true }, take: 1 } } : {}),
      },
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: base, select: { status: true, dataAdmissao: true, desligadoEm: true } }),
  ]);
  const ativos = resumo.filter((p) => p.status === "ativo");
  const comAdmissao = ativos.filter((p) => p.dataAdmissao);
  const mediaCasa = comAdmissao.length ? comAdmissao.reduce((s, p) => s + (h.getTime() - p.dataAdmissao!.getTime()), 0) / comAdmissao.length / (30.4375 * 86_400_000) : null;
  const admissoes90 = resumo.filter((p) => p.dataAdmissao && p.dataAdmissao >= somarDias(h, -90) && p.dataAdmissao <= h).length;
  const desligados12 = resumo.filter((p) => p.status === "desligado" && p.desligadoEm && p.desligadoEm >= somarDias(h, -365)).length;
  const podeCriar = pode(ctx, "cadastro", "criar") === "todos" && !ctx.suporte;
  const podeImportar = podeCriar && pode(ctx, "cadastro", "editar") === "todos";
  const podeExportar = !!pode(ctx, "cadastro", "exportar");
  const colunas = ["Colaborador", "Cargo", "Equipe e área", "Gestor", "Admissão", "Situação", ...(fb || pdi || onb ? ["Jornada"] : []), "Acesso"];

  return (
    <>
      <CabecalhoPagina
        titulo="Colaboradores"
        descricao={
          escopo === "equipe"
            ? "Sua equipe. Este cadastro é usado por todos os módulos ativos."
            : "Base de colaboradores da empresa — cadastro único usado por Onboarding, Feedback 1:1, PDI, Pulse, NR-1, Offboarding, Retenção e People Analytics."
        }
        acao={
          <div className="flex flex-wrap gap-2">
            {podeExportar && <LinkExportar href="/colaboradores/exportar" />}
            {podeImportar && (
              <Link href="/colaboradores/importar" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
                <FileUp className="size-4" aria-hidden /> Importar CSV
              </Link>
            )}
            {podeCriar && (
              <Link href="/colaboradores/nova" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
                <Plus data-icon="inline-start" /> Nova pessoa
              </Link>
            )}
          </div>
        }
      />
      <section aria-label="Resumo da base" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Ativos" valor={String(ativos.length)} icone={UserCheck} detalhe={`${resumo.filter((p) => p.status === "pre_admissao").length} em pré-admissão`} href="/colaboradores?status=ativo" />
        <Indicador rotulo="Admissões (90 dias)" valor={String(admissoes90)} icone={UserPlus} detalhe="Pela data de admissão" />
        <Indicador rotulo="Desligados (12 meses)" valor={String(desligados12)} icone={UserMinus} detalhe="Pela data de desligamento" href="/colaboradores?status=desligado" />
        <Indicador
          rotulo="Tempo médio de casa"
          valor={mediaCasa === null ? "—" : mediaCasa >= 12 ? `${(mediaCasa / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos` : `${Math.round(mediaCasa)} meses`}
          icone={Clock}
          detalhe={`${ativos.length - comAdmissao.length} ativo(s) sem data de admissão`}
          alerta={ativos.length - comAdmissao.length > 0}
        />
      </section>
      <BarraBusca q={sp.q} placeholder="Nome, e-mail ou cargo">
        <FiltroSelect nome="status" rotulo="Situação" valor={sp.status} opcoes={Object.entries(STATUS_PESSOA).map(([valor, s]) => ({ valor, rotulo: s.nome }))} />
        <FiltroSelect nome="area" rotulo="Área" valor={area} opcoes={areas.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
        <FiltroSelect nome="equipe" rotulo="Equipe" valor={sp.equipe} opcoes={equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
      </BarraBusca>
      {pessoas.length === 0 ? (
        <EstadoVazio
          titulo={sp.q || sp.status || sp.equipe || area ? "Nenhum colaborador com esses filtros" : "Nenhum colaborador cadastrado"}
          descricao={podeCriar ? "Importe a base atual por planilha, cadastre a primeira pessoa ou converta um candidato contratado no CRM." : "Não há pessoas visíveis para o seu papel."}
        />
      ) : (
        <Tabela colunas={colunas} minWidth={1080}>
          {pessoas.map((p) => {
            const av = (p as { avaliacoesRecebidas?: { data: Date; semaforo: keyof typeof SEMAFORO }[] }).avaliacoesRecebidas?.[0];
            const planos = (p as unknown as { pdis?: { focos: Parameters<typeof calcularPdi>[0] }[] }).pdis;
            const plano = planos?.map((x) => calcularPdi(x.focos, h)).find((c) => c.status !== "concluido");
            const o = (p as { onboardings?: { id: string; progresso: number }[] }).onboardings?.[0];
            return (
              <tr key={p.id}>
                <Celula>
                  <span className="flex items-center gap-3">
                    <Iniciais nome={p.nome} />
                    <span className="min-w-0">
                      <Link href={`/colaboradores/${p.id}`} className="font-medium hover:text-teal-strong">
                        {p.nome}
                      </Link>
                      {p.email && <span className="block text-xs text-muted-foreground">{p.email}</span>}
                    </span>
                  </span>
                </Celula>
                <Celula className="text-muted-foreground">{p.cargo ?? "—"}</Celula>
                <Celula className="text-muted-foreground">
                  {p.equipe?.nome ?? "—"}
                  {p.equipe?.area && <span className="block text-xs">{p.equipe.area.nome}</span>}
                </Celula>
                <Celula className="text-muted-foreground">{p.gestor?.nome ?? "—"}</Celula>
                <Celula className="tabular-nums text-muted-foreground">
                  {p.dataAdmissao ? formatarData(p.dataAdmissao) : "—"}
                  {p.dataAdmissao && p.status !== "desligado" && <span className="block text-xs">{casa(p.dataAdmissao, h)} de casa</span>}
                </Celula>
                <Celula>
                  <Selo tom={STATUS_PESSOA[p.status].tom}>{STATUS_PESSOA[p.status].nome}</Selo>
                </Celula>
                {(fb || pdi || onb) && (
                  <Celula>
                    {p.status === "desligado" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="flex flex-col gap-0.5 text-xs">
                        {onb && o && (
                          <Link href={`/onboarding/${o.id}`} className="hover:text-teal-strong">
                            Onboarding {o.progresso}%
                          </Link>
                        )}
                        {fb && (
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ background: av ? (av.semaforo === "verde" ? "var(--success)" : av.semaforo === "amarelo" ? "var(--warning)" : "var(--destructive)") : "var(--border)" }} aria-hidden />
                            {av ? `Feedback ${formatarData(av.data)}` : "Sem feedback"}
                          </span>
                        )}
                        {pdi && <span className={plano?.status === "em_risco" ? "text-destructive" : "text-muted-foreground"}>{plano ? `PDI ${STATUS_PDI[plano.status].nome.toLowerCase()} · ${plano.progresso}%` : "Sem PDI ativo"}</span>}
                      </span>
                    )}
                  </Celula>
                )}
                <Celula className="text-muted-foreground">{p.associacao ? "Com acesso" : "—"}</Celula>
              </tr>
            );
          })}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q, status: sp.status, equipe: sp.equipe, area }} />
    </>
  );
}
