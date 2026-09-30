import "server-only";

import { transacao } from "@/lib/db";
import { emailValido, enviarEmail, esc } from "@/lib/email";
import { formatarDataHora } from "@/lib/formato";
import { SISTEMA } from "@/lib/integracoes/processar";

export const plataformaCarreiras = { escopo: "plataforma" as const, usuarioId: SISTEMA };

const COR_PADRAO = "#0B1F3A";
const corSegura = (c: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : COR_PADRAO);
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "";

/**
 * Aviso de nova candidatura ao CRIADOR da vaga, no e-mail conferido antes da
 * publicação. O currículo NÃO vai anexado: o e-mail traz um link autenticado
 * (/crm/anexos/:id), que exige login na organização e permissão no CRM e então
 * emite uma URL assinada de 60 s. Antes de enviar, confere que o criador ainda
 * tem acesso ativo à MESMA organização da vaga. Resultado gravado na candidatura
 * (pendente → enviado | falhou) para exibição e reenvio no painel.
 */
export async function enviarAvisoCandidatura(candidaturaId: string): Promise<{ ok: boolean; erro?: string }> {
  const d = await transacao(plataformaCarreiras, async (tx) => {
    const c = await tx.candidatura.findUnique({
      where: { id: candidaturaId },
      include: {
        vaga: { select: { id: true, titulo: true, tenantId: true, emailNotificacao: true, emailConfirmadoEm: true, criadoPorUsuarioId: true } },
        candidato: { select: { id: true, nome: true, email: true, telefone: true } },
        anexo: { select: { id: true, nomeArquivo: true } },
      },
    });
    if (!c) return null;
    const org = await tx.organizacao.findUnique({ where: { id: c.tenantId }, select: { nome: true, corMarca: true } });
    const criadorAtivo = c.vaga.criadoPorUsuarioId
      ? !!(await tx.associacao.findFirst({ where: { usuarioId: c.vaga.criadoPorUsuarioId, tenantId: c.tenantId, status: "ativa" }, select: { id: true } }))
      : false;
    return { c, org, criadorAtivo };
  });
  if (!d) return { ok: false, erro: "Candidatura não encontrada." };
  const { c, org, criadorAtivo } = d;

  let erro: string | null = null;
  const destino = c.vaga.emailNotificacao;
  if (!destino || !emailValido(destino) || !c.vaga.emailConfirmadoEm) erro = "A vaga não tem e-mail de notificação confirmado.";
  else if (!criadorAtivo) erro = "O criador da vaga não tem mais acesso ativo a esta organização; o aviso não foi enviado.";
  else {
    const cor = corSegura(org?.corMarca ?? null);
    const quando = formatarDataHora(c.atualizadoEm.toISOString());
    const linkCandidato = `${site()}/crm/candidatos/${c.candidato.id}`;
    const linkCurriculo = c.anexo ? `${site()}/crm/anexos/${c.anexo.id}` : null;
    const linkVaga = `${site()}/pagina-carreiras/vagas/${c.vaga.id}`;
    const assunto = `Nova candidatura: ${c.vaga.titulo} — ${c.candidato.nome}`;
    const linhas = [
      ["Vaga", c.vaga.titulo],
      ["Candidato", c.candidato.nome],
      ["E-mail", c.candidato.email ?? "—"],
      ["Telefone", c.candidato.telefone ?? "—"],
      ["Data da candidatura", quando],
    ];
    const texto = [
      `Nova candidatura recebida pela Página de Carreiras de ${org?.nome ?? ""}.`,
      "",
      ...linhas.map(([k, v]) => `${k}: ${v}`),
      "",
      linkCurriculo ? `Currículo (acesso com login no JourneyLab): ${linkCurriculo}` : "Currículo: indisponível",
      `Candidato no CRM: ${linkCandidato}`,
      `Candidaturas da vaga: ${linkVaga}`,
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1F3A">
      <div style="background:${cor};padding:18px 24px;border-radius:12px 12px 0 0"><strong style="color:#fff;font-size:17px">Nova candidatura · ${esc(org?.nome ?? "")}</strong></div>
      <div style="border:1px solid #E2E8EE;border-top:0;padding:24px;border-radius:0 0 12px 12px">
        <table style="border-collapse:collapse;width:100%;font-size:14px">${linhas
          .map(([k, v]) => `<tr><td style="padding:6px 0;color:#526173;width:170px">${esc(k)}</td><td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`)
          .join("")}</table>
        <p style="margin:24px 0 12px">${
          linkCurriculo
            ? `<a href="${esc(linkCurriculo)}" style="background:${cor};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:bold">Abrir currículo</a>`
            : "Currículo indisponível."
        }</p>
        <p><a href="${esc(linkCandidato)}" style="color:${cor}">Ver candidato no CRM</a> · <a href="${esc(linkVaga)}" style="color:${cor}">Ver candidaturas da vaga</a></p>
        <p style="color:#526173;font-size:12px">Os links exigem login no JourneyLab com acesso ao CRM de ${esc(org?.nome ?? "")}. O currículo não é enviado anexo por segurança.</p>
      </div></div>`;
    try {
      await enviarEmail({ para: destino, assunto, texto, html });
    } catch (e) {
      erro = e instanceof Error ? e.message : "Falha no envio do e-mail.";
    }
  }
  await transacao(plataformaCarreiras, (tx) =>
    tx.candidatura.update({
      where: { id: c.id },
      data: { notificacaoStatus: erro ? "falhou" : "enviado", notificacaoErro: erro, notificacaoEm: new Date(), notificacaoTentativas: { increment: 1 } },
    }),
  );
  return erro ? { ok: false, erro } : { ok: true };
}
