import "server-only";

import { dbTenant } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import { lerRespostas } from "@/lib/offboarding/questionario";
import { lerConfig } from "./referencias";
import type { Pessoa, Saida } from "./calculo";

const civil = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Base de movimentação da organização: pessoas (admissão e saída) e saídas.
 * Saídas vêm do Offboarding (com tipo, motivos e entrevista) e, para pessoas
 * desligadas sem registro, só da data no cadastro (classificação desconhecida).
 * Admissão ausente: usa a data de cadastro. Pré-admissão fica fora.
 * Só agregados saem daqui para as telas — nenhuma resposta individual.
 */
export async function carregarBase(ctx: Contexto, filtro: { areaId?: string | null } = {}) {
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const [colabs, deslig, areas] = await Promise.all([
    db.colaborador.findMany({
      where: { status: { not: "pre_admissao" } },
      select: { id: true, nome: true, dataAdmissao: true, criadoEm: true, desligadoEm: true, status: true, gestorId: true, equipeId: true, equipe: { select: { areaId: true } } },
      take: 50_000,
    }),
    db.desligamento.findMany({
      select: {
        colaboradorId: true,
        data: true,
        voluntario: true,
        perdaLamentada: true,
        admissao: true,
        areaId: true,
        areaNome: true,
        gestorId: true,
        gestorNome: true,
        motivoDeclarado: true,
        motivosReais: true,
        motivoPrincipalReal: true,
        enps: true,
        evitavel: true,
        entrevistaStatus: true,
        respostas: true,
      },
      orderBy: { data: "asc" },
      take: 50_000,
    }),
    db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const ultimoRegistro = new Map<string, (typeof deslig)[number]>();
  for (const d of deslig) ultimoRegistro.set(d.colaboradorId, d);

  const pessoas: Pessoa[] = [];
  const saidas: Saida[] = [];
  for (const c of colabs) {
    const admissao = c.dataAdmissao ?? civil(c.criadoEm);
    const reg = c.status === "desligado" ? ultimoRegistro.get(c.id) : undefined;
    const saida = c.status === "desligado" ? (reg?.data ?? (c.desligadoEm ? civil(c.desligadoEm) : null)) : null;
    const areaId = reg?.areaId ?? c.equipe?.areaId ?? null;
    if (filtro.areaId && areaId !== filtro.areaId) continue;
    pessoas.push({ id: c.id, admissao, saida, areaId, equipeId: c.equipeId, gestorId: reg?.gestorId ?? c.gestorId });
    if (saida && !reg) {
      saidas.push({
        colaboradorId: c.id,
        data: saida,
        voluntario: null,
        perdaLamentada: false,
        admissao,
        areaId,
        areaNome: null,
        gestorId: c.gestorId,
        gestorNome: null,
        motivoDeclarado: null,
        motivosReais: [],
        motivoPrincipalReal: null,
        enps: null,
        evitavel: null,
        entrevistaStatus: null,
        experiencia: null,
      });
    }
  }
  const visiveis = new Set(pessoas.map((p) => p.id));
  for (const d of deslig) {
    if (!visiveis.has(d.colaboradorId)) continue;
    saidas.push({
      colaboradorId: d.colaboradorId,
      data: d.data,
      voluntario: d.voluntario,
      perdaLamentada: d.perdaLamentada,
      admissao: d.admissao,
      areaId: d.areaId,
      areaNome: d.areaNome,
      gestorId: d.gestorId,
      gestorNome: d.gestorNome,
      motivoDeclarado: d.motivoDeclarado,
      motivosReais: d.motivosReais,
      motivoPrincipalReal: d.motivoPrincipalReal,
      enps: d.enps,
      evitavel: d.evitavel,
      entrevistaStatus: d.entrevistaStatus,
      experiencia: lerRespostas(d.respostas)?.experiencia ?? null,
    });
  }
  return { pessoas, saidas, areas, nomes: new Map(colabs.map((c) => [c.id, c.nome])) };
}

export async function carregarConfigAnalytics(ctx: Contexto) {
  const c = await dbTenant(ctx.org.id, ctx.usuario.id).configuracaoAnalytics.findUnique({ where: { tenantId: ctx.org.id } });
  return lerConfig(c?.referencias);
}
