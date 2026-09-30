import "server-only";

import { dbTenant } from "@/lib/db";
import { pode, type Contexto } from "@/lib/contexto";
import { filtroVagas } from "@/lib/crm/consultas";
import { filtroOnboardings, hojeSemHora } from "@/lib/onboarding/regras";
import { buscarAlertas, contarAlertas, type AlertaOnboarding } from "@/lib/onboarding/alertas";
import { RESPONSAVEL } from "@/lib/onboarding/calculo";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { filtroAvaliacoes, filtroReunioes } from "@/lib/feedback/regras";
import { carregarCadencia, ordenarPorCadencia } from "@/lib/feedback/consultas";
import { umaCasa } from "@/lib/feedback/avaliacao";
import { COM_ACOES, filtroPdis } from "@/lib/pdi/regras";
import { calcularPdi } from "@/lib/pdi/calculo";
import { somarDias, hoje as hojeCivil } from "@/lib/datas";
import { filtroParaResponder } from "@/lib/pulse/regras";
import { adesaoPulse } from "@/lib/pulse/consultas";
import { transacao } from "@/lib/db";
import { urlRespostaNr1 } from "@/lib/nr1/links";
import { plataformaNr1 } from "@/lib/nr1/publico";
import type { Modulo } from "@/lib/permissoes";

export type BlocoPendencias = {
  modulo: Modulo;
  titulo: string;
  href: string;
  vazio: string;
  itens: { texto: string; subtitulo?: string; detalhe?: string; href: string; alerta?: boolean }[];
  /** Linha de resumo opcional sob o título do bloco. */
  resumo?: string;
};

/** `paraTodos`: roda para quem está na organização com o módulo ativo, sem exigir permissão (ex.: responder pesquisas). */
type Provedor = { modulo: Modulo; paraTodos?: boolean; montar: (ctx: Contexto) => Promise<BlocoPendencias | null> };

/**
 * Pendências por módulo. Cada provedor só roda se o módulo estiver ATIVO e o
 * papel puder visualizar — indicadores nunca vêm de módulos não contratados.
 */
const PROVEDORES: Provedor[] = [
  {
    modulo: "crm",
    async montar(ctx) {
      const escopo = pode(ctx, "crm", "visualizar")!;
      const vagas = await dbTenant(ctx.org.id, ctx.usuario.id).vaga.findMany({
        where: { AND: [filtroVagas(ctx, escopo), { status: "aberta" }] },
        include: { _count: { select: { candidaturas: true } } },
        orderBy: { abertaEm: "asc" },
        take: 5,
      });
      return {
        modulo: "crm",
        titulo: "Vagas abertas",
        href: "/crm/vagas?status=aberta",
        vazio: "Nenhuma vaga aberta no momento.",
        itens: vagas.map((v) => ({
          texto: v.titulo,
          subtitulo: `Aberta em ${formatarData(v.abertaEm)}`,
          detalhe: `${v._count.candidaturas} candidatos`,
          href: `/crm/vagas/${v.id}`,
        })),
      };
    },
  },
  {
    // Alertas de onboarding: só RH/Admin e gestores (escopo mínimo "equipe" em lib/contexto.ts).
    modulo: "onboarding",
    async montar(ctx) {
      const escopo = pode(ctx, "onboarding", "visualizar")!;
      const alertas = await buscarAlertas(ctx, escopo, 50);
      const c = contarAlertas(alertas);
      const prioridade = (x: AlertaOnboarding) => (x.sinais.atrasada ? 0 : x.sinais.bloqueada ? 1 : x.sinais.venceHoje ? 2 : 3);
      return {
        modulo: "onboarding",
        titulo: "Alertas de onboarding",
        href: "/onboarding?visao=painel",
        vazio: "Nenhuma tarefa atrasada, bloqueada ou vencendo nos próximos 3 dias.",
        resumo: `${c.atrasadas} atrasada(s) · ${c.bloqueadas} bloqueada(s) · ${c.hoje + c.proximas} vencendo em até 3 dias`,
        itens: [...alertas]
          .sort((x, y) => prioridade(x) - prioridade(y))
          .slice(0, 6)
          .map((x) => ({
            texto: x.titulo,
            subtitulo: `${x.colaborador} · ${RESPONSAVEL[x.responsavelTipo]}`,
            detalhe: x.sinais.atrasada
              ? `Atrasada · ${formatarData(x.prazo)}`
              : x.sinais.bloqueada
                ? "Bloqueada"
                : x.sinais.venceHoje
                  ? "Vence hoje"
                  : `Vence ${formatarData(x.prazo)}`,
            alerta: x.sinais.atrasada || x.sinais.bloqueada,
            href: `/onboarding/${x.onboardingId}#tarefa-${x.tarefaId}`,
          })),
      };
    },
  },
  {
    modulo: "feedback",
    async montar(ctx) {
      const escopo = pode(ctx, "feedback", "visualizar")!;
      const agora = new Date();
      const limite = new Date(agora);
      limite.setDate(limite.getDate() + 14);
      const lista = await dbTenant(ctx.org.id, ctx.usuario.id).reuniao.findMany({
        where: { AND: [filtroReunioes(ctx, escopo), { status: "agendada", dataHora: { gte: new Date(agora.getTime() - 3600_000), lte: limite } }] },
        include: { colaborador: { select: { id: true, nome: true } }, gestor: { select: { nome: true } } },
        orderBy: { dataHora: "asc" },
        take: 5,
      });
      return {
        modulo: "feedback",
        titulo: "Próximos 1:1",
        href: "/feedback",
        vazio: "Nenhum 1:1 nos próximos 14 dias.",
        itens: lista.map((r) => ({
          texto: r.colaborador.id === ctx.colaboradorId ? `Com ${r.gestor.nome}` : r.colaborador.nome,
          subtitulo: r.colaborador.id === ctx.colaboradorId ? "Seu 1:1" : `Gestor: ${r.gestor.nome}`,
          detalhe: formatarDataHora(r.dataHora.toISOString()),
          href: `/feedback/${r.id}`,
        })),
      };
    },
  },
  {
    modulo: "pdi",
    async montar(ctx) {
      // Alertas: uma linha por ação não concluída vencida (ou vencendo em 7 dias), no escopo do usuário.
      const escopo = pode(ctx, "pdi", "visualizar")!;
      const h = hojeCivil();
      const where = { status: { in: ["nao_iniciada" as const, "em_andamento" as const] }, prazo: { lte: somarDias(h, 7) }, pdi: filtroPdis(ctx, escopo) };
      const db = dbTenant(ctx.org.id, ctx.usuario.id);
      const [acoes, vencidas] = await Promise.all([
        db.acaoPdi.findMany({
          where,
          include: { pdi: { select: { id: true, colaborador: { select: { nome: true } } } } },
          orderBy: [{ prazo: "asc" }],
          take: 5,
        }),
        db.acaoPdi.count({ where: { ...where, prazo: { lt: h } } }),
      ]);
      return {
        modulo: "pdi",
        titulo: vencidas ? `Ações de PDI vencidas (${vencidas})` : "Ações de PDI com prazo próximo",
        href: vencidas ? "/pdi?status=em_risco" : "/pdi",
        vazio: "Nenhuma ação de PDI vencida ou vencendo nos próximos 7 dias.",
        itens: acoes.map((a) => {
          const vencida = !!a.prazo && a.prazo < h;
          return {
            texto: a.descricao,
            subtitulo: a.pdi.colaborador.nome,
            detalhe: vencida ? `Vencida · ${formatarData(a.prazo!)}` : `Prazo ${formatarData(a.prazo!)}`,
            alerta: vencida,
            href: `/pdi/${a.pdi.id}#acao-${a.id}`,
          };
        }),
      };
    },
  },
  {
    modulo: "pulse",
    paraTodos: true,
    async montar(ctx) {
      if (!ctx.colaboradorId || ctx.suporte) return null;
      const db = dbTenant(ctx.org.id, ctx.usuario.id);
      const eu = await db.colaborador.findUnique({ where: { id: ctx.colaboradorId }, select: { id: true, equipeId: true, status: true, equipe: { select: { areaId: true } } } });
      if (!eu || eu.status !== "ativo") return null;
      const lista = await db.pesquisaPulse.findMany({
        where: filtroParaResponder({ id: eu.id, equipeId: eu.equipeId, areaId: eu.equipe?.areaId ?? null }),
        orderBy: { encerraEm: { sort: "asc", nulls: "last" } },
        take: 5,
      });
      if (!lista.length) return null;
      return {
        modulo: "pulse",
        titulo: "Pesquisas para responder",
        href: `/pesquisa/responder/${lista[0].id}`,
        vazio: "",
        itens: lista.map((p) => ({
          texto: p.titulo,
          subtitulo: p.anonima ? "Anônima · poucos minutos" : "Identificada · poucos minutos",
          detalhe: p.encerraEm ? `Até ${formatarData(p.encerraEm)}` : "Responder",
          href: `/pesquisa/responder/${p.id}`,
        })),
      };
    },
  },
  {
    modulo: "nr1",
    paraTodos: true,
    // Convites pendentes da própria pessoa: o link leva à página pública (o colaborador não acessa o módulo interno).
    async montar(ctx) {
      if (!ctx.colaboradorId || ctx.suporte) return null;
      const h = hojeCivil();
      const convites = await dbTenant(ctx.org.id, ctx.usuario.id).conviteNr1.findMany({
        where: {
          colaboradorId: ctx.colaboradorId,
          ciclo: { status: "aberto", AND: [{ OR: [{ encerraEm: null }, { encerraEm: { gte: h } }] }, { OR: [{ dataInicio: null }, { dataInicio: { lte: h } }] }] },
        },
        select: { id: true, ciclo: { select: { titulo: true, encerraEm: true } } },
        take: 5,
      });
      const usados = await transacao(plataformaNr1, (tx) =>
        Promise.all(convites.map((c) => tx.$queryRaw<{ usado: boolean }[]>`select public.jl_convite_nr1_usado(${c.id}::uuid) as usado`)),
      );
      const pendentes = convites.filter((_, i) => !usados[i][0]?.usado);
      if (!pendentes.length) return null;
      return {
        modulo: "nr1",
        titulo: "Pesquisa sobre condições de trabalho",
        href: urlRespostaNr1(pendentes[0].id),
        vazio: "",
        itens: pendentes.map((c) => ({
          texto: c.ciclo.titulo,
          subtitulo: "Respostas sem identificação · cerca de 10 minutos",
          detalhe: c.ciclo.encerraEm ? `Até ${formatarData(c.ciclo.encerraEm)}` : "Responder",
          href: urlRespostaNr1(c.id),
        })),
      };
    },
  },
  {
    // Cadência de feedback: atrasados e próximos (mesma fonte da página do módulo).
    modulo: "feedback",
    async montar(ctx) {
      const escopo = pode(ctx, "feedback", "visualizar")!;
      const linhas = (await carregarCadencia(ctx, escopo)).filter((l) => l.cadencia.estado === "atrasado" || l.cadencia.estado === "proximo").sort(ordenarPorCadencia);
      const atrasados = linhas.filter((l) => l.cadencia.estado === "atrasado").length;
      return {
        modulo: "feedback",
        titulo: "Cadência de feedback",
        href: "/feedback#cadencia",
        vazio: "Todos os feedbacks em dia.",
        resumo: linhas.length ? `${atrasados} atrasado(s) · ${linhas.length - atrasados} próximo(s)` : undefined,
        itens: linhas.slice(0, 6).map((l) => ({
          texto: l.nome,
          subtitulo: l.ultimo ? `Último feedback: ${formatarData(l.ultimo.data)}` : "Sem feedback — referência: data de entrada",
          detalhe: l.cadencia.estado === "atrasado" ? `Atrasado ${-(l.cadencia.dias ?? 0)} d` : l.cadencia.dias === 0 ? "Hoje" : `Em ${l.cadencia.dias} d`,
          alerta: l.cadencia.estado === "atrasado",
          href: l.proximo1a1 ? `/feedback/${l.proximo1a1.id}` : `/feedback/agendar?colaborador=${l.id}`,
        })),
      };
    },
  },
];

export async function montarPendencias(ctx: Contexto) {
  const ativos = PROVEDORES.filter((p) => ctx.modulos.has(p.modulo) && (p.paraTodos || pode(ctx, p.modulo, "visualizar")));
  const blocos = await Promise.all(ativos.map((p) => p.montar(ctx).catch(() => null)));
  return blocos.filter((b): b is BlocoPendencias => b !== null);
}

export type Indicador = {
  modulo: Modulo;
  rotulo: string;
  valor: string;
  detalhe: string;
  href: string;
  /** 0–100: barra de progresso sob o número (padrão de KPI do painel). */
  progresso?: number;
  alerta?: boolean;
};

type ProvedorIndicadores = { modulo: Modulo; montar: (ctx: Contexto) => Promise<Indicador[]> };

/** Indicadores do topo do painel — mesmas regras de módulo ativo + permissão das pendências. */
const INDICADORES: ProvedorIndicadores[] = [
  {
    modulo: "crm",
    async montar(ctx) {
      const escopo = pode(ctx, "crm", "visualizar")!;
      const db = dbTenant(ctx.org.id, ctx.usuario.id);
      const vagas = filtroVagas(ctx, escopo);
      const ha30 = new Date(Date.now() - 30 * 86_400_000);
      const [abertas, emProcesso, contratacoes] = await Promise.all([
        db.vaga.count({ where: { AND: [vagas, { status: "aberta" }] } }),
        db.candidatura.count({ where: { vaga: { AND: [vagas, { status: "aberta" }] }, status: { in: ["inscrito", "em_avaliacao", "entrevista", "aprovado"] } } }),
        db.candidatura.count({ where: { vaga: vagas, status: "contratado", atualizadoEm: { gte: ha30 } } }),
      ]);
      return [
        { modulo: "crm", rotulo: "Vagas abertas", valor: String(abertas), detalhe: `${emProcesso} candidatos em processo`, href: "/crm/vagas?status=aberta" },
        { modulo: "crm", rotulo: "Contratações", valor: String(contratacoes), detalhe: "nos últimos 30 dias", href: "/crm?status=contratado" },
      ];
    },
  },
  {
    modulo: "onboarding",
    async montar(ctx) {
      const escopo = pode(ctx, "onboarding", "visualizar")!;
      const db = dbTenant(ctx.org.id, ctx.usuario.id);
      const h = hojeSemHora();
      const filtro = { AND: [filtroOnboardings(ctx, escopo), { status: "em_andamento" as const, inicio: { lte: h } }] };
      const [lista, alertas] = await Promise.all([db.onboarding.findMany({ where: filtro, select: { progresso: true } }), buscarAlertas(ctx, escopo)]);
      const media = lista.length ? Math.round(lista.reduce((n, o) => n + o.progresso, 0) / lista.length) : 0;
      const c = contarAlertas(alertas);
      return [
        {
          modulo: "onboarding",
          rotulo: "Onboardings em andamento",
          valor: String(lista.length),
          detalhe: lista.length ? `${media}% de progresso médio` : "Nenhum em andamento",
          href: "/onboarding?status=em_andamento",
          progresso: lista.length ? media : undefined,
        },
        {
          modulo: "onboarding",
          rotulo: "Alertas de onboarding",
          valor: String(c.atrasadas + c.bloqueadas),
          detalhe: c.atrasadas + c.bloqueadas ? `${c.atrasadas} atrasada(s) · ${c.bloqueadas} bloqueada(s)` : c.hoje + c.proximas ? `${c.hoje + c.proximas} vencendo em até 3 dias` : "Tudo em dia",
          href: "/onboarding?visao=painel",
          alerta: c.atrasadas + c.bloqueadas > 0,
        },
      ];
    },
  },
  {
    modulo: "feedback",
    async montar(ctx) {
      const escopo = pode(ctx, "feedback", "visualizar")!;
      const ha90 = hojeSemHora();
      ha90.setUTCDate(ha90.getUTCDate() - 90);
      const [linhas, recentes] = await Promise.all([
        carregarCadencia(ctx, escopo),
        dbTenant(ctx.org.id, ctx.usuario.id).avaliacaoFeedback.findMany({ where: { AND: [filtroAvaliacoes(ctx, escopo), { data: { gte: ha90 } }] }, select: { mediaGeral: true } }),
      ]);
      const atrasados = linhas.filter((l) => l.cadencia.estado === "atrasado").length;
      const proximos = linhas.filter((l) => l.cadencia.estado === "proximo").length;
      const media = recentes.length ? recentes.reduce((n, r) => n + Number(r.mediaGeral), 0) / recentes.length : null;
      return [
        {
          modulo: "feedback",
          rotulo: "Feedbacks atrasados",
          valor: String(atrasados),
          detalhe: `${proximos} próximo(s)${media !== null ? ` · média geral 90 d: ${umaCasa(media)}` : ""}`,
          href: "/feedback#cadencia",
          alerta: atrasados > 0,
        },
      ];
    },
  },
  {
    modulo: "pdi",
    async montar(ctx) {
      const escopo = pode(ctx, "pdi", "visualizar")!;
      const pdis = await dbTenant(ctx.org.id, ctx.usuario.id).pdi.findMany({ where: filtroPdis(ctx, escopo), include: COM_ACOES, take: 500 });
      const h = hojeCivil();
      const calc = pdis.map((p) => calcularPdi(p.focos, h));
      const abertos = calc.filter((c) => c.status !== "concluido");
      const risco = calc.filter((c) => c.status === "em_risco").length;
      const media = abertos.length ? Math.round(abertos.reduce((n, c) => n + c.progresso, 0) / abertos.length) : 0;
      return [
        {
          modulo: "pdi",
          rotulo: "PDIs em andamento",
          valor: String(abertos.length),
          detalhe: abertos.length ? `${media}% de progresso médio${risco ? ` · ${risco} em risco` : ""}` : "Nenhum plano em andamento",
          href: risco ? "/pdi?status=em_risco" : "/pdi",
          progresso: abertos.length ? media : undefined,
          alerta: risco > 0,
        },
      ];
    },
  },
  {
    modulo: "pulse",
    async montar(ctx) {
      if (pode(ctx, "pulse", "visualizar") !== "todos") return [];
      const abertas = await dbTenant(ctx.org.id, ctx.usuario.id).pesquisaPulse.findMany({ where: { status: "aberta" }, select: { id: true }, take: 10 });
      const adesoes = await Promise.all(abertas.map((p) => adesaoPulse(ctx, p.id)));
      const publico = adesoes.reduce((n, a) => n + a.publico, 0);
      const resp = adesoes.reduce((n, a) => n + a.respondentes, 0);
      const pct = publico ? Math.round((resp / publico) * 100) : 0;
      return [
        {
          modulo: "pulse",
          rotulo: "Pesquisas abertas",
          valor: String(abertas.length),
          detalhe: abertas.length ? `${pct}% de adesão` : "Nenhuma em coleta",
          href: "/pulse?status=aberta",
          progresso: abertas.length ? pct : undefined,
        },
      ];
    },
  },
  {
    modulo: "nr1",
    async montar(ctx) {
      if (pode(ctx, "nr1", "visualizar") !== "todos") return [];
      const db = dbTenant(ctx.org.id, ctx.usuario.id);
      const [abertas, atrasadas, riscosAltos] = await Promise.all([
        db.acaoNr1.count({ where: { status: { in: ["pendente", "em_andamento"] } } }),
        db.acaoNr1.count({ where: { status: { in: ["pendente", "em_andamento"] }, prazo: { lt: hojeSemHora() } } }),
        db.riscoNr1.count({ where: { prioridade: "alta", status: { not: "encerrado" } } }),
      ]);
      return [
        {
          modulo: "nr1",
          rotulo: "Plano de ação NR-1",
          valor: String(abertas),
          detalhe: atrasadas ? `${atrasadas} medida(s) atrasada(s)` : `${riscosAltos} risco(s) de prioridade alta`,
          href: "/nr1",
          alerta: atrasadas > 0,
        },
      ];
    },
  },
];

export async function montarIndicadores(ctx: Contexto) {
  const ativos = INDICADORES.filter((p) => ctx.modulos.has(p.modulo) && pode(ctx, p.modulo, "visualizar"));
  const listas = await Promise.all(ativos.map((p) => p.montar(ctx).catch(() => [] as Indicador[])));
  return listas.flat();
}
