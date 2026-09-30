import "server-only";

import type { Contexto } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";

/** Departamentos, pessoas ativas e mínimo da organização para o formulário de diagnóstico. */
export async function dadosFormularioNr1(ctx: Contexto) {
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const [departamentos, pessoas] = await Promise.all([
    db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true, equipe: { select: { area: { select: { nome: true } } } } }, orderBy: { nome: "asc" } }),
  ]);
  return { departamentos, pessoas: pessoas.map((p) => ({ id: p.id, nome: p.nome, departamento: p.equipe?.area?.nome ?? null })), minimo: ctx.org.minimoRecorte };
}
