import "server-only";

import { dbTenant } from "@/lib/db";
import { pode, filtroColaboradores, type Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import { hoje as hojeCivil, somarDias } from "@/lib/datas";
import { calcularPdi } from "@/lib/pdi/calculo";
import { COM_ACOES } from "@/lib/pdi/regras";

/**
 * Risco de saída — INDICATIVO, para priorizar conversas e ações (não é decisão
 * automatizada sobre a pessoa e não deve ser usado para desligar ou punir).
 * Calculado a cada consulta a partir de sinais dos módulos que o papel pode ver;
 * cada fator aparece por escrito ao lado da pontuação (transparência).
 *
 *  +15 primeiros 6 meses de casa (+10 entre 6 e 12 meses)
 *  +25 último feedback no vermelho (+12 no amarelo)
 *  +10 queda de 0,5 ponto ou mais entre os dois últimos feedbacks
 *  +10 sem feedback há mais de 120 dias (ou nunca, com mais de 90 dias de casa)
 *  + 8 PDI com ações vencidas  · + 8 sem PDI ativo com mais de 1 ano de casa
 *  + 8 talento-chave (último feedback verde com média ≥ 4) sem PDI ativo
 *  + 8 onboarding com tarefas atrasadas
 *  +12 gestor com 2 ou mais saídas voluntárias nos últimos 12 meses
 *  + 8 área com turnover voluntário ≥ 20% nos últimos 12 meses
 *  Nível: alto ≥ 45 · médio 25–44 · baixo < 25 (máximo 100)
 */

export type NivelRisco = "alto" | "medio" | "baixo";
export const NIVEL_RISCO: Record<NivelRisco, { nome: string; tom: "perigo" | "alerta" | "sucesso" }> = {
  alto: { nome: "Risco alto", tom: "perigo" },
  medio: { nome: "Risco médio", tom: "alerta" },
  baixo: { nome: "Risco baixo", tom: "sucesso" },
};

export type Fator = { texto: string; pontos: number; categoria: string };
export type RiscoPessoa = {
  id: string;
  nome: string;
  cargo: string | null;
  equipe: string | null;
  area: string | null;
  areaId: string | null;
  gestor: string | null;
  gestorId: string | null;
  tempoCasaMeses: number;
  pontos: number;
  nivel: NivelRisco;
  talentoChave: boolean;
  fatores: Fator[];
  acoesAbertas: number;
};

export const nivelDe = (pontos: number): NivelRisco => (pontos >= 45 ? "alto" : pontos >= 25 ? "medio" : "baixo");

/** Pessoas visíveis no escopo da Retenção (gestor: só liderados, nunca ele mesmo). */
export function filtroRetencao(ctx: Contexto, escopo: Escopo) {
  if (escopo === "todos") return {};
  return { gestorId: ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000" };
}

export async function carregarRiscos(ctx: Contexto, escopo: Escopo): Promise<RiscoPessoa[]> {
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const h = hojeCivil();
  const ha12m = somarDias(h, -365);
  const fb = !!pode(ctx, "feedback", "visualizar");
  const pdi = !!pode(ctx, "pdi", "visualizar");
  const onb = !!pode(ctx, "onboarding", "visualizar");

  const pessoas = await db.colaborador.findMany({
    where: { AND: [{ status: "ativo" }, filtroRetencao(ctx, escopo), escopo === "todos" ? {} : filtroColaboradores(ctx, escopo)] },
    select: {
      id: true,
      nome: true,
      cargo: true,
      dataAdmissao: true,
      criadoEm: true,
      gestorId: true,
      gestor: { select: { nome: true } },
      equipe: { select: { nome: true, areaId: true, area: { select: { nome: true } } } },
      avaliacoesRecebidas: fb ? { orderBy: [{ data: "desc" }, { criadoEm: "desc" }], take: 2, select: { data: true, semaforo: true, mediaGeral: true } } : false,
      pdis: pdi ? { include: COM_ACOES, orderBy: { criadoEm: "desc" }, take: 3 } : false,
      onboardings: onb ? { where: { status: "em_andamento" }, select: { tarefas: { where: { status: { in: ["nao_iniciada", "em_andamento", "bloqueada"] }, prazo: { lt: h } }, select: { id: true } } } } : false,
      acoesRetencao: { where: { status: { in: ["planejada", "em_andamento"] } }, select: { id: true } },
    },
    orderBy: { nome: "asc" },
    take: 5000,
  });
  if (!pessoas.length) return [];

  // Sinais coletivos (últimos 12 meses): saídas voluntárias por gestor e turnover voluntário por área.
  const [saidas12m, ativosPorArea] = await Promise.all([
    db.desligamento.findMany({ where: { data: { gte: ha12m }, voluntario: true }, select: { gestorId: true, areaId: true } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { equipe: { select: { areaId: true } } } }),
  ]);
  const porGestor = new Map<string, number>();
  const porArea = new Map<string, number>();
  for (const s of saidas12m) {
    if (s.gestorId) porGestor.set(s.gestorId, (porGestor.get(s.gestorId) ?? 0) + 1);
    if (s.areaId) porArea.set(s.areaId, (porArea.get(s.areaId) ?? 0) + 1);
  }
  const hcArea = new Map<string, number>();
  for (const a of ativosPorArea) if (a.equipe?.areaId) hcArea.set(a.equipe.areaId, (hcArea.get(a.equipe.areaId) ?? 0) + 1);

  return pessoas
    .map((p) => {
      const fatores: Fator[] = [];
      const admissao = p.dataAdmissao ?? p.criadoEm;
      const dias = Math.max(0, Math.round((h.getTime() - admissao.getTime()) / 86_400_000));
      if (dias < 183) fatores.push({ texto: "Primeiros 6 meses de casa — fase de maior risco de saída", pontos: 15, categoria: "crescimento" });
      else if (dias < 365) fatores.push({ texto: "Primeiro ano de casa", pontos: 10, categoria: "crescimento" });

      let talento = false;
      const avs = (p.avaliacoesRecebidas ?? []) as unknown as { data: Date; semaforo: string; mediaGeral: unknown }[];
      if (fb) {
        const [u, pen] = avs;
        if (u?.semaforo === "vermelho") fatores.push({ texto: "Último feedback no vermelho", pontos: 25, categoria: "lideranca" });
        else if (u?.semaforo === "amarelo") fatores.push({ texto: "Último feedback no amarelo", pontos: 12, categoria: "lideranca" });
        if (u && pen && Number(pen.mediaGeral) - Number(u.mediaGeral) >= 0.5)
          fatores.push({ texto: `Queda na média do feedback (${Number(pen.mediaGeral).toFixed(1)} → ${Number(u.mediaGeral).toFixed(1)})`, pontos: 10, categoria: "lideranca" });
        const semFeedback = u ? (h.getTime() - u.data.getTime()) / 86_400_000 > 120 : dias > 90;
        if (semFeedback) fatores.push({ texto: u ? "Sem feedback há mais de 120 dias" : "Nunca recebeu feedback registrado", pontos: 10, categoria: "reconhecimento" });
        talento = u?.semaforo === "verde" && Number(u.mediaGeral) >= 4;
      }
      if (pdi) {
        const planos = ((p.pdis ?? []) as unknown as { focos: Parameters<typeof calcularPdi>[0] }[]).map((x) => calcularPdi(x.focos, h));
        const ativo = planos.find((x) => x.status !== "concluido");
        if (ativo?.status === "em_risco") fatores.push({ texto: "PDI com ações vencidas", pontos: 8, categoria: "crescimento" });
        if (!ativo && talento) fatores.push({ texto: "Talento-chave sem PDI ativo", pontos: 8, categoria: "crescimento" });
        else if (!ativo && dias >= 365) fatores.push({ texto: "Sem PDI ativo após o primeiro ano", pontos: 8, categoria: "crescimento" });
      }
      if (onb) {
        const atrasadas = ((p.onboardings ?? []) as unknown as { tarefas: { id: string }[] }[]).reduce((n, o) => n + o.tarefas.length, 0);
        if (atrasadas) fatores.push({ texto: `Onboarding com ${atrasadas} tarefa(s) atrasada(s)`, pontos: 8, categoria: "cultura" });
      }
      const sg = p.gestorId ? (porGestor.get(p.gestorId) ?? 0) : 0;
      if (sg >= 2) fatores.push({ texto: `Gestor com ${sg} saídas voluntárias em 12 meses`, pontos: 12, categoria: "lideranca" });
      const areaId = p.equipe?.areaId ?? null;
      if (areaId) {
        const hc = hcArea.get(areaId) ?? 0;
        const sa = porArea.get(areaId) ?? 0;
        if (hc >= 3 && sa / (hc + sa / 2) >= 0.2) fatores.push({ texto: "Área com turnover voluntário de 20% ou mais em 12 meses", pontos: 8, categoria: "cultura" });
      }
      const pontos = Math.min(100, fatores.reduce((s, f) => s + f.pontos, 0));
      return {
        id: p.id,
        nome: p.nome,
        cargo: p.cargo,
        equipe: p.equipe?.nome ?? null,
        area: p.equipe?.area?.nome ?? null,
        areaId,
        gestor: p.gestor?.nome ?? null,
        gestorId: p.gestorId,
        tempoCasaMeses: Math.round(dias / 30.4375),
        pontos,
        nivel: nivelDe(pontos),
        talentoChave: talento,
        fatores: fatores.sort((a, b) => b.pontos - a.pontos),
        acoesAbertas: p.acoesRetencao.length,
      } satisfies RiscoPessoa;
    })
    .sort((a, b) => b.pontos - a.pontos || Number(b.talentoChave) - Number(a.talentoChave) || a.nome.localeCompare(b.nome));
}

/** Fator dominante (categoria com mais pontos) — sugere o tipo de ação. */
export function categoriaDominante(r: RiscoPessoa) {
  const soma = new Map<string, number>();
  for (const f of r.fatores) soma.set(f.categoria, (soma.get(f.categoria) ?? 0) + f.pontos);
  return [...soma.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "outro";
}
