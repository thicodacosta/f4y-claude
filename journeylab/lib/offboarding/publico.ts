import "server-only";

import { transacao, type Tx } from "@/lib/db";
import { entitlementLibera } from "@/lib/entitlements";
import { SISTEMA } from "@/lib/integracoes/processar";
import { entrevistaDoToken } from "./links";

export const plataformaOffboarding = { escopo: "plataforma" as const, usuarioId: SISTEMA };

export type EstadoEntrevista =
  | { estado: "invalido" }
  | { estado: "expirada"; org: OrgPublica }
  | { estado: "respondida"; org: OrgPublica }
  | { estado: "ativa"; org: OrgPublica; primeiroNome: string };
type OrgPublica = { nome: string; corMarca: string | null; logoUrl: string | null };

/**
 * Valida o link (assinatura + envio vigente + prazo + módulo ativo) e devolve só o
 * necessário para a página: organização e primeiro nome. Usado pela página e,
 * de novo, no envio das respostas (dentro da mesma transação da gravação).
 */
export async function validarEntrevista(tx: Tx, token: string) {
  const t = entrevistaDoToken(token);
  if (!t) return null;
  const r = await tx.desligamento.findUnique({
    where: { id: t.id },
    select: { id: true, tenantId: true, entrevistaStatus: true, entrevistaEnviadaEm: true, entrevistaExpiraEm: true, colaborador: { select: { nome: true } } },
  });
  // Link de um envio anterior (o convite foi reenviado) não vale mais.
  if (!r || !r.entrevistaEnviadaEm || r.entrevistaEnviadaEm.getTime() !== t.enviadaEm) return null;
  const [org, ent] = await Promise.all([
    tx.organizacao.findUnique({ where: { id: r.tenantId }, select: { nome: true, corMarca: true, logoUrl: true, ativa: true } }),
    tx.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: r.tenantId, modulo: "offboarding" } } }),
  ]);
  if (!org?.ativa || !ent || !entitlementLibera(ent)) return null;
  return { r, org: { nome: org.nome, corMarca: org.corMarca, logoUrl: org.logoUrl } };
}

export async function carregarEntrevistaPublica(token: string): Promise<EstadoEntrevista> {
  return transacao(plataformaOffboarding, async (tx) => {
    const v = await validarEntrevista(tx, token);
    if (!v) return { estado: "invalido" as const };
    if (v.r.entrevistaStatus === "respondida") return { estado: "respondida" as const, org: v.org };
    if (v.r.entrevistaStatus !== "enviada" || (v.r.entrevistaExpiraEm && v.r.entrevistaExpiraEm < new Date())) return { estado: "expirada" as const, org: v.org };
    return { estado: "ativa" as const, org: v.org, primeiroNome: v.r.colaborador.nome.split(" ")[0] };
  });
}
