import "server-only";

import { cache } from "react";
import { transacao } from "@/lib/db";
import { plataformaCarreiras } from "./notificacao";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Colunas públicas da vaga — nada de dados internos (criador, e-mails, equipe, gestor, candidaturas). */
const VAGA_PUBLICA = { id: true, slug: true, titulo: true, descricao: true, requisitos: true, local: true, modelo: true, tipoContratacao: true, publicadaEm: true, status: true, publicada: true } as const;

/**
 * Organização da página pública: ativa e com o CRM (produto que inclui a Página
 * de Carreiras) liberado. Só nome e identidade visual saem daqui.
 */
export const orgPublica = cache(async (slug: string) => {
  if (!SLUG.test(slug)) return null;
  return transacao(plataformaCarreiras, async (tx) => {
    const org = await tx.organizacao.findUnique({ where: { slug }, select: { id: true, nome: true, slug: true, corMarca: true, logoUrl: true, ativa: true } });
    if (!org?.ativa) return null;
    const ent = await tx.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: org.id, modulo: "crm" } } });
    const agora = new Date();
    const liberado = !!ent && (ent.status === "ativo" || ent.status === "teste") && ent.inicio <= agora && (!ent.fim || ent.fim >= agora);
    return liberado ? org : null;
  });
});

/** Conteúdo configurado da página (tolerante a conteúdo inválido). */
export async function conteudoPublico(orgId: string) {
  const { lerConteudo } = await import("./pagina");
  const p = await transacao(plataformaCarreiras, (tx) => tx.paginaCarreiras.findUnique({ where: { tenantId: orgId }, select: { conteudo: true } }));
  return lerConteudo(p?.conteudo);
}

/** Vagas publicadas e abertas da organização. */
export async function vagasPublicas(orgId: string) {
  return transacao(plataformaCarreiras, (tx) =>
    tx.vaga.findMany({ where: { tenantId: orgId, publicada: true, status: "aberta" }, select: VAGA_PUBLICA, orderBy: { publicadaEm: "desc" } }),
  );
}

/** Uma vaga pela URL pública — só se publicada (encerradas/pausadas aparecem como indisponíveis). */
export const vagaPublica = cache(async (orgId: string, vagaSlug: string) => {
  if (!SLUG.test(vagaSlug)) return null;
  const v = await transacao(plataformaCarreiras, (tx) => tx.vaga.findUnique({ where: { tenantId_slug: { tenantId: orgId, slug: vagaSlug } }, select: VAGA_PUBLICA }));
  return v && (v.publicada || v.status === "fechada" || v.status === "cancelada") ? v : null;
});
