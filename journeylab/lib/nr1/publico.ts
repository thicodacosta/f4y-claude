import "server-only";

import { transacao } from "@/lib/db";
import { hoje } from "@/lib/datas";
import { SISTEMA } from "@/lib/integracoes/processar";
import { conviteNr1DoToken } from "./links";

export const plataformaNr1 = { escopo: "plataforma" as const, usuarioId: SISTEMA };

/**
 * Página pública: valida o link assinado e carrega só o necessário para
 * responder (questionário congelado, organização, departamentos se coletados).
 * Nenhum dado da pessoa convidada é enviado ao navegador.
 */
export async function carregarNr1Publico(token: string) {
  const conviteId = conviteNr1DoToken(token);
  if (!conviteId) return { estado: "invalido" as const };
  const d = await transacao(plataformaNr1, async (tx) => {
    const conv = await tx.conviteNr1.findUnique({ where: { id: conviteId }, select: { id: true, cicloId: true, tenantId: true } });
    if (!conv) return null;
    const c = await tx.cicloNr1.findUnique({
      where: { id: conv.cicloId },
      include: { dimensoes: { orderBy: { ordem: "asc" }, include: { perguntas: { orderBy: { ordem: "asc" }, select: { id: true, texto: true } } } } },
    });
    const org = await tx.organizacao.findUnique({ where: { id: conv.tenantId }, select: { nome: true, corMarca: true, logoUrl: true, minimoRecorte: true, ativa: true } });
    const ent = await tx.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: conv.tenantId, modulo: "nr1" } } });
    const [uso] = await tx.$queryRaw<{ usado: boolean }[]>`select public.jl_convite_nr1_usado(${conv.id}::uuid) as usado`;
    const areas = c?.coletarDepartamento
      ? await tx.area.findMany({ where: { tenantId: conv.tenantId, ...(c.audienciaTipo === "departamentos" ? { id: { in: c.areaIds } } : {}) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } })
      : [];
    return { conv, c, org, ent, usado: !!uso?.usado, areas };
  });
  if (!d || !d.c || !d.org?.ativa) return { estado: "invalido" as const };
  const agora = new Date();
  const liberado = !!d.ent && (d.ent.status === "ativo" || d.ent.status === "teste") && d.ent.inicio <= agora && (!d.ent.fim || d.ent.fim >= agora);
  if (!liberado || d.c.status === "rascunho") return { estado: "invalido" as const };
  const h = hoje();
  const base = {
    org: { nome: d.org.nome, corMarca: d.org.corMarca, logoUrl: d.org.logoUrl, minimo: d.org.minimoRecorte },
    ciclo: { titulo: d.c.titulo, descricao: d.c.descricao, encerraEm: d.c.encerraEm, coletarDepartamento: d.c.coletarDepartamento },
  };
  if (d.c.status === "encerrado" || (d.c.encerraEm && d.c.encerraEm < h)) return { estado: "encerrada" as const, ...base };
  if (d.c.dataInicio && d.c.dataInicio > h) return { estado: "nao_iniciada" as const, ...base };
  if (d.usado) return { estado: "usado" as const, ...base };
  return {
    estado: "ativa" as const,
    ...base,
    areas: d.areas,
    secoes: d.c.dimensoes.filter((x) => x.perguntas.length).map((x) => ({ id: x.id, nome: x.nome, descricao: x.descricao, perguntas: x.perguntas })),
  };
}
