import "server-only";

import { transacao } from "@/lib/db";
import { cookies } from "next/headers";
import { getUsuario } from "@/lib/contexto";
import { hoje } from "@/lib/datas";
import { SISTEMA } from "@/lib/integracoes/processar";
import { conviteDoToken } from "./links";
import { deBanco, type PerguntaDef } from "./perguntas";

export const plataforma = { escopo: "plataforma" as const, usuarioId: SISTEMA };

/** Cookie httpOnly que marca resposta enviada pelo link aberto (controle só no navegador). */
export const cookieLinkAberto = (id: string) => `pulse_${id.replace(/-/g, "").slice(0, 24)}`;

export type Respondente =
  | { modo: "convite" | "sessao"; colaboradorId: string; nome: string }
  | { modo: "aberto"; colaboradorId: null; nome: null }
  | { modo: "negado"; colaboradorId: null; nome: null };

/**
 * Carrega a pesquisa para a página pública e identifica quem responde:
 *  1) link pessoal (?t=) — assinatura HMAC válida e convite desta pesquisa;
 *  2) sessão de alguém da organização vinculado a um cadastro;
 *  3) link aberto (opcional, só anônimas).
 * Só lê o necessário para responder (nada de resultados ou dados de outras pesquisas).
 */
export async function carregarParaResponder(pesquisaId: string, token: string | null) {
  if (!/^[0-9a-f-]{36}$/.test(pesquisaId)) return null;
  const dados = await transacao(plataforma, async (tx) => {
    const p = await tx.pesquisaPulse.findUnique({
      where: { id: pesquisaId },
      include: { perguntas: { orderBy: { ordem: "asc" } } },
    });
    if (!p) return null;
    const org = await tx.organizacao.findUnique({ where: { id: p.tenantId }, select: { nome: true, corMarca: true, logoUrl: true, minimoRecorte: true, ativa: true } });
    const ent = await tx.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: p.tenantId, modulo: "pulse" } } });
    let convite: { colaboradorId: string } | null = null;
    const conviteId = conviteDoToken(token);
    if (conviteId) convite = await tx.convitePulse.findFirst({ where: { id: conviteId, pesquisaId }, select: { colaboradorId: true } });
    return { p, org, ent, convite };
  });
  if (!dados || !dados.org?.ativa) return null;
  const { p, org, ent, convite } = dados;
  const agora = new Date();
  const liberado = !!ent && (ent.status === "ativo" || ent.status === "teste") && ent.inicio <= agora && (!ent.fim || ent.fim >= agora);
  if (!liberado || p.status === "rascunho") return null;

  const h = hoje();
  const situacao: "ativa" | "nao_iniciada" | "encerrada" =
    p.status === "encerrada" || (p.encerraEm && p.encerraEm < h) ? "encerrada" : p.dataInicio && p.dataInicio > h ? "nao_iniciada" : "ativa";

  let respondente: Respondente = { modo: "negado", colaboradorId: null, nome: null };
  let colaboradorId: string | null = convite?.colaboradorId ?? null;
  let modo: "convite" | "sessao" | null = convite ? "convite" : null;
  if (!colaboradorId) {
    const usuario = await getUsuario();
    if (usuario) {
      const a = await transacao(plataforma, (tx) =>
        tx.associacao.findFirst({ where: { usuarioId: usuario.id, tenantId: p.tenantId, status: "ativa", colaboradorId: { not: null } }, select: { colaboradorId: true } }),
      );
      if (a?.colaboradorId) {
        colaboradorId = a.colaboradorId;
        modo = "sessao";
      }
    }
  }
  let jaRespondeu = false;
  let naAudiencia = true;
  if (colaboradorId && modo) {
    const r = await transacao(plataforma, async (tx) => {
      const pessoa = await tx.colaborador.findUnique({ where: { id: colaboradorId! }, select: { nome: true } });
      const [aud] = await tx.$queryRaw<{ ok: boolean }[]>`select public.jl_na_audiencia_pulse(${pesquisaId}::uuid, ${colaboradorId}::uuid) as ok`;
      const part = await tx.participacaoPulse.findUnique({ where: { pesquisaId_colaboradorId: { pesquisaId, colaboradorId: colaboradorId! } } });
      return { nome: pessoa?.nome ?? "", aud: aud?.ok ?? false, part: !!part };
    });
    naAudiencia = r.aud;
    jaRespondeu = r.part;
    if (r.aud) respondente = { modo, colaboradorId, nome: r.nome };
  } else if (p.linkAberto && p.anonima) {
    respondente = { modo: "aberto", colaboradorId: null, nome: null };
    jaRespondeu = !!(await cookies()).get(cookieLinkAberto(p.id));
  }

  const perguntas: (PerguntaDef & { dbId: string })[] = p.perguntas.map((q) => ({ ...deBanco(q), dbId: q.id }));
  return {
    pesquisa: { id: p.id, titulo: p.titulo, descricao: p.descricao, anonima: p.anonima, encerraEm: p.encerraEm, linkAberto: p.linkAberto },
    org: { nome: org.nome, corMarca: org.corMarca, logoUrl: org.logoUrl, minimoRecorte: org.minimoRecorte },
    perguntas,
    situacao,
    respondente,
    jaRespondeu,
    naAudiencia,
  };
}
