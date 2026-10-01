import "server-only";

import { dbTenant } from "@/lib/db";
import { pode, type Contexto } from "@/lib/contexto";
import { somarDias } from "@/lib/datas";
import { calcularPdi } from "@/lib/pdi/calculo";
import { COM_ACOES } from "@/lib/pdi/regras";
import { adesaoPulse, enpsDaPesquisa } from "@/lib/pulse/consultas";
import { calcularEnpsNotas, CHAVES_DIMENSAO, DIMENSOES } from "@/lib/offboarding/questionario";
import { carregarRiscos, type RiscoPessoa } from "@/lib/retencao-talentos/risco";
import type { Modulo } from "@/lib/permissoes";
import { carregarBase, carregarConfigAnalytics } from "./base";
import {
  calcularTurnover,
  contar,
  faixaCasa,
  FAIXAS_CASA,
  headcountEm,
  inclinacao,
  pct,
  projetarSaidas90d,
  retencao12m,
  serieMensal,
  tempoMedioCasaMeses,
  umaCasaNum,
  type Periodo,
} from "./calculo";

const DIA = 86_400_000;
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const entre = (d: Date | null | undefined, ini: Date, fim: Date) => !!d && d >= ini && d < new Date(fim.getTime() + DIA);

/** O módulo entra na análise se estiver contratado e o papel puder ver os dados da organização inteira. */
const ve = (ctx: Contexto, m: Modulo) => ctx.modulos.has(m) && pode(ctx, m, "visualizar") === "todos";

/**
 * Todos os indicadores do People Analytics para o período (e área, opcional).
 * Cada seção só é calculada se o módulo de origem estiver ativo e o papel puder
 * ver a organização inteira; seções ausentes ficam `null` (a tela explica).
 */
export async function carregarPeopleAnalytics(ctx: Contexto, periodo: Periodo, areaId: string | null) {
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const { inicio, fim, anterior } = periodo;
  const [base, config] = await Promise.all([carregarBase(ctx, { areaId }), carregarConfigAnalytics(ctx)]);
  const { pessoas, saidas } = base;

  // ── Pessoas e movimentação ──
  const atual = calcularTurnover(pessoas, saidas, inicio, fim);
  const prev = calcularTurnover(pessoas, saidas, anterior.inicio, anterior.fim);
  const ano = calcularTurnover(pessoas, saidas, somarDias(fim, -364), fim);
  const serie = serieMensal(pessoas, saidas, periodo.dias < 365 ? somarDias(fim, -364) : inicio, fim);
  const saidasPeriodo = saidas.filter((s) => entre(s.data, inicio, fim));

  const porArea = base.areas
    .map((a) => {
      const ps = pessoas.filter((p) => p.areaId === a.id);
      const ss = saidas.filter((s) => s.areaId === a.id);
      const t = calcularTurnover(ps, ss, inicio, fim);
      return { id: a.id, nome: a.nome, headcount: t.hcFim, saidas: t.saidas, voluntarias: t.voluntarias, turnoverAnualizado: t.turnoverAnualizado };
    })
    .filter((a) => a.headcount > 0 || a.saidas > 0)
    .sort((a, b) => (b.turnoverAnualizado ?? 0) - (a.turnoverAnualizado ?? 0));

  const porGestor = contar(saidas.filter((s) => s.voluntario && s.gestorId && s.data > somarDias(fim, -365)).map((s) => s.gestorId!))
    .filter((g) => g.n >= 2)
    .map((g) => ({ id: g.chave, nome: saidas.find((s) => s.gestorId === g.chave)?.gestorNome ?? base.nomes.get(g.chave) ?? "Gestor", saidasVoluntarias: g.n }));

  const casa = FAIXAS_CASA.map((f) => ({ ...f, n: saidasPeriodo.filter((s) => faixaCasa(s.admissao, s.data) === f.chave).length }));

  // ── Motivos e entrevistas (Offboarding) ──
  let saida: null | {
    entrevistadas: number;
    taxaEntrevista: number | null;
    enps: number | null;
    evitavel: number | null;
    motivosDeclarados: { chave: string; n: number }[];
    motivosReais: { chave: string; n: number }[];
    principaisReais: { chave: string; n: number }[];
    divergencia: number | null;
    experiencia: { chave: string; nome: string; media: number | null }[];
    lamentadas: number;
  } = null;
  if (ctx.modulos.has("offboarding")) {
    const registradas = saidasPeriodo.filter((s) => s.entrevistaStatus !== null);
    const resp = registradas.filter((s) => s.entrevistaStatus === "respondida");
    const comparaveis = resp.filter((s) => s.motivoPrincipalReal && s.motivoDeclarado);
    saida = {
      entrevistadas: resp.length,
      taxaEntrevista: umaCasaNum(pct(resp.length, registradas.filter((s) => s.entrevistaStatus !== "dispensada").length)),
      enps: calcularEnpsNotas(resp.map((s) => s.enps).filter((n): n is number => n !== null)),
      evitavel: umaCasaNum(pct(resp.filter((s) => s.evitavel === "sim" || s.evitavel === "talvez").length, resp.length)),
      motivosDeclarados: contar(registradas.map((s) => s.motivoDeclarado)),
      motivosReais: contar(resp.flatMap((s) => s.motivosReais)),
      principaisReais: contar(resp.map((s) => s.motivoPrincipalReal)),
      divergencia: umaCasaNum(pct(comparaveis.filter((s) => s.motivoPrincipalReal !== s.motivoDeclarado).length, comparaveis.length)),
      experiencia: CHAVES_DIMENSAO.map((d) => ({ chave: d, nome: DIMENSOES[d], media: umaCasaNum(media(resp.map((s) => s.experiencia?.[d]).filter((n): n is number => typeof n === "number"))) })).sort(
        (a, b) => (a.media ?? 9) - (b.media ?? 9),
      ),
      lamentadas: saidasPeriodo.filter((s) => s.perdaLamentada).length,
    };
  }

  // ── Risco de saída (Retenção) ──
  let riscos: RiscoPessoa[] | null = null;
  if (ve(ctx, "retencao")) {
    riscos = await carregarRiscos(ctx, "todos");
    if (areaId) riscos = riscos.filter((r) => r.areaId === areaId);
  }
  const emRiscoAlto = riscos?.filter((r) => r.nivel === "alto").length ?? 0;
  const projecao = projetarSaidas90d(serie, emRiscoAlto, atual.hcFim);
  const tendencia = inclinacao(serie.map((p) => p.turnover ?? 0));

  // ── Atração e Seleção (CRM) ──
  let atracao: null | {
    vagasAbertas: number;
    posicoesAbertas: number;
    vagasAtrasadas: number;
    candidaturas: number;
    candidaturasAnterior: number;
    contratacoes: number;
    timeToFill: number | null;
    timeToHire: number | null;
    funil: { etapa: string; n: number }[];
    viaCarreiras: number | null;
    etapas: { chave: string; n: number }[];
  } = null;
  if (ve(ctx, "crm")) {
    const [vagas, cand, candPrev] = await Promise.all([
      db.vaga.findMany({ where: areaId ? { equipe: { areaId } } : {}, select: { status: true, abertaEm: true, fechadaEm: true, posicoes: true, prazoFechamento: true, etapaPipeline: true } }),
      db.candidatura.findMany({ where: { criadoEm: { gte: inicio, lt: new Date(fim.getTime() + DIA) }, ...(areaId ? { vaga: { equipe: { areaId } } } : {}) }, select: { status: true, origem: true, criadoEm: true, atualizadoEm: true } }),
      db.candidatura.count({ where: { criadoEm: { gte: anterior.inicio, lt: new Date(anterior.fim.getTime() + DIA) }, ...(areaId ? { vaga: { equipe: { areaId } } } : {}) } }),
    ]);
    const abertas = vagas.filter((v) => v.status === "aberta" || v.status === "pausada");
    const fechadas = vagas.filter((v) => v.status === "fechada" && entre(v.fechadaEm, inicio, fim));
    const contratados = cand.filter((c) => c.status === "contratado");
    // Funil por etapa alcançada (a etapa atual implica as anteriores; "não seguiu"/"desistiu" contam só como inscritos).
    const ordem = ["inscrito", "em_avaliacao", "entrevista", "aprovado", "contratado"];
    const alcancou = (s: string, etapa: string) => ordem.indexOf(s) >= ordem.indexOf(etapa);
    atracao = {
      vagasAbertas: abertas.length,
      posicoesAbertas: abertas.reduce((n, v) => n + v.posicoes, 0),
      vagasAtrasadas: abertas.filter((v) => v.prazoFechamento && v.prazoFechamento < fim).length,
      candidaturas: cand.length,
      candidaturasAnterior: candPrev,
      contratacoes: contratados.length,
      timeToFill: umaCasaNum(media(fechadas.map((v) => (v.fechadaEm!.getTime() - v.abertaEm.getTime()) / DIA))),
      timeToHire: umaCasaNum(media(contratados.map((c) => (c.atualizadoEm.getTime() - c.criadoEm.getTime()) / DIA))),
      funil: [
        { etapa: "Candidaturas", n: cand.length },
        { etapa: "Em avaliação", n: cand.filter((c) => alcancou(c.status, "em_avaliacao")).length },
        { etapa: "Entrevista", n: cand.filter((c) => alcancou(c.status, "entrevista")).length },
        { etapa: "Aprovados", n: cand.filter((c) => alcancou(c.status, "aprovado")).length },
        { etapa: "Contratados", n: contratados.length },
      ],
      viaCarreiras: umaCasaNum(pct(cand.filter((c) => c.origem === "carreiras").length, cand.length)),
      etapas: contar(abertas.map((v) => v.etapaPipeline)),
    };
  }

  // ── Desenvolvimento ──
  const ativosIds = new Set(pessoas.filter((p) => p.admissao <= fim && (!p.saida || p.saida > fim)).map((p) => p.id));
  let onboarding: null | { iniciados: number; concluidos: number; noPrazo: number | null; emAndamento: number; progressoMedio: number | null; tarefasAtrasadas: number } = null;
  if (ve(ctx, "onboarding")) {
    const onbs = await db.onboarding.findMany({
      where: areaId ? { colaborador: { equipe: { areaId } } } : {},
      select: { status: true, inicio: true, concluidoEm: true, progresso: true, fases: { select: { marcoDias: true } }, tarefas: { where: { status: { in: ["nao_iniciada", "em_andamento", "bloqueada"] }, prazo: { lt: fim } }, select: { id: true } } },
    });
    const concl = onbs.filter((o) => o.status === "concluido" && entre(o.concluidoEm, inicio, fim));
    const noPrazo = concl.filter((o) => o.concluidoEm! <= new Date(o.inicio.getTime() + (Math.max(0, ...o.fases.map((f) => f.marcoDias)) + 1) * DIA));
    const andamento = onbs.filter((o) => o.status === "em_andamento" && o.inicio <= fim);
    onboarding = {
      iniciados: onbs.filter((o) => entre(o.inicio, inicio, fim)).length,
      concluidos: concl.length,
      noPrazo: umaCasaNum(pct(noPrazo.length, concl.length)),
      emAndamento: andamento.length,
      progressoMedio: umaCasaNum(media(andamento.map((o) => o.progresso))),
      tarefasAtrasadas: andamento.reduce((n, o) => n + o.tarefas.length, 0),
    };
  }

  let feedback: null | { avaliacoes: number; cobertura90d: number | null; mediaGeral: number | null; mediaAnterior: number | null; semaforo: Record<string, number>; reunioes: number } = null;
  if (ve(ctx, "feedback")) {
    const [avs, reun] = await Promise.all([
      db.avaliacaoFeedback.findMany({ where: { data: { gte: somarDias(anterior.inicio, -120) } }, select: { colaboradorId: true, data: true, mediaGeral: true, semaforo: true }, orderBy: { data: "desc" } }),
      db.reuniao.count({ where: { status: "realizada", dataHora: { gte: inicio, lt: new Date(fim.getTime() + DIA) } } }),
    ]);
    const dosAtivos = avs.filter((a) => ativosIds.has(a.colaboradorId));
    const noPeriodo = dosAtivos.filter((a) => entre(a.data, inicio, fim));
    const anteriores = avs.filter((a) => entre(a.data, anterior.inicio, anterior.fim) && pessoas.some((p) => p.id === a.colaboradorId));
    const recentes = new Set(dosAtivos.filter((a) => a.data >= somarDias(fim, -90) && a.data <= fim).map((a) => a.colaboradorId));
    const ultimo = new Map<string, string>();
    for (const a of dosAtivos) if (a.data <= fim && !ultimo.has(a.colaboradorId)) ultimo.set(a.colaboradorId, a.semaforo);
    const semaforo = { verde: 0, amarelo: 0, vermelho: 0 } as Record<string, number>;
    for (const s of ultimo.values()) semaforo[s] = (semaforo[s] ?? 0) + 1;
    feedback = {
      avaliacoes: noPeriodo.length,
      cobertura90d: umaCasaNum(pct(recentes.size, ativosIds.size)),
      mediaGeral: umaCasaNum(media(noPeriodo.map((a) => Number(a.mediaGeral)))),
      mediaAnterior: umaCasaNum(media(anteriores.map((a) => Number(a.mediaGeral)))),
      semaforo,
      reunioes: reun,
    };
  }

  let pdi: null | { cobertura: number | null; emAndamento: number; emRisco: number; acoesConcluidas: number; progressoMedio: number | null } = null;
  if (ve(ctx, "pdi")) {
    const [planos, acoes] = await Promise.all([
      db.pdi.findMany({ where: { colaboradorId: { in: [...ativosIds] } }, include: COM_ACOES, take: 5000 }),
      db.acaoPdi.count({ where: { status: "concluida", concluidaEm: { gte: inicio, lt: new Date(fim.getTime() + DIA) }, pdi: { colaboradorId: { in: [...ativosIds] } } } }),
    ]);
    const calc = planos.map((p) => ({ colab: p.colaboradorId, ...calcularPdi(p.focos, fim) }));
    const abertos = calc.filter((c) => c.status !== "concluido");
    pdi = {
      cobertura: umaCasaNum(pct(new Set(abertos.map((c) => c.colab)).size, ativosIds.size)),
      emAndamento: abertos.length,
      emRisco: abertos.filter((c) => c.status === "em_risco").length,
      acoesConcluidas: acoes,
      progressoMedio: umaCasaNum(media(abertos.map((c) => c.progresso))),
    };
  }

  // ── Saúde do colaborador ──
  let pulse: null | { pesquisas: number; adesao: number | null; enps: number | null; enpsPesquisa: string | null } = null;
  if (ve(ctx, "pulse") && !areaId) {
    const ps = await db.pesquisaPulse.findMany({
      where: { status: { not: "rascunho" }, OR: [{ abertaEm: { gte: inicio, lt: new Date(fim.getTime() + DIA) } }, { encerradaEm: { gte: inicio, lt: new Date(fim.getTime() + DIA) } }] },
      select: { id: true, titulo: true, status: true, encerradaEm: true, perguntas: { where: { tipo: "nps" }, select: { id: true } } },
      orderBy: { criadoEm: "desc" },
      take: 30,
    });
    const ad = await Promise.all(ps.map((p) => adesaoPulse(ctx, p.id)));
    const taxas = ad.filter((a) => a.publico > 0).map((a) => Math.min(100, (a.respondentes / a.publico) * 100));
    const comNps = ps.filter((p) => p.status === "encerrada" && p.perguntas.length);
    let enps: number | null = null;
    let enpsPesquisa: string | null = null;
    for (const p of comNps) {
      const e = await enpsDaPesquisa(ctx, p.id, p.perguntas.map((x) => x.id));
      if (e) {
        enps = e.enps;
        enpsPesquisa = p.titulo;
        break;
      }
    }
    pulse = { pesquisas: ps.length, adesao: umaCasaNum(media(taxas)), enps, enpsPesquisa };
  }

  let nr1: null | { riscosAltos: number; acoesAbertas: number; acoesAtrasadas: number; ultimoCiclo: string | null } = null;
  if (ve(ctx, "nr1") && !areaId) {
    const [riscosAltos, acoesAbertas, acoesAtrasadas, ultimo] = await Promise.all([
      db.riscoNr1.count({ where: { prioridade: "alta", status: { not: "encerrado" } } }),
      db.acaoNr1.count({ where: { status: { in: ["pendente", "em_andamento"] } } }),
      db.acaoNr1.count({ where: { status: { in: ["pendente", "em_andamento"] }, prazo: { lt: fim } } }),
      db.cicloNr1.findFirst({ where: { status: "encerrado" }, orderBy: { encerradoEm: "desc" }, select: { titulo: true } }),
    ]);
    nr1 = { riscosAltos, acoesAbertas, acoesAtrasadas, ultimoCiclo: ultimo?.titulo ?? null };
  }

  let acoesRetencao: null | { abertas: number; atrasadas: number; concluidasPeriodo: number; riscoAltoSemAcao: number } = null;
  if (ve(ctx, "retencao")) {
    const [abertas, atrasadas, concluidas] = await Promise.all([
      db.acaoRetencao.count({ where: { status: { in: ["planejada", "em_andamento"] } } }),
      db.acaoRetencao.count({ where: { status: { in: ["planejada", "em_andamento"] }, prazo: { lt: fim } } }),
      db.acaoRetencao.count({ where: { status: "concluida", concluidaEm: { gte: inicio, lt: new Date(fim.getTime() + DIA) } } }),
    ]);
    acoesRetencao = { abertas, atrasadas, concluidasPeriodo: concluidas, riscoAltoSemAcao: riscos?.filter((r) => r.nivel === "alto" && r.acoesAbertas === 0).length ?? 0 };
  }

  const custo =
    config.salarioMedioMensal && config.mesesCustoReposicao ? { porSaida: config.salarioMedioMensal * config.mesesCustoReposicao, total: config.salarioMedioMensal * config.mesesCustoReposicao * atual.saidas } : null;

  return {
    periodo,
    config,
    areas: base.areas,
    pessoas: {
      headcount: atual.hcFim,
      headcountAnterior: prev.hcFim,
      tempoMedioCasaMeses: tempoMedioCasaMeses(pessoas, fim),
      retencao12m: retencao12m(pessoas, fim),
      admissoes: atual.admissoes,
      admissoesAnterior: prev.admissoes,
      headcountHa12m: headcountEm(pessoas, somarDias(fim, -365)),
    },
    turnover: atual,
    turnoverAnterior: prev,
    turnover12m: ano,
    serie,
    tendencia,
    porArea,
    porGestor,
    casa,
    saida,
    riscos,
    projecao,
    atracao,
    onboarding,
    feedback,
    pdi,
    pulse,
    nr1,
    acoesRetencao,
    custo,
  };
}

export type PeopleAnalytics = Awaited<ReturnType<typeof carregarPeopleAnalytics>>;
