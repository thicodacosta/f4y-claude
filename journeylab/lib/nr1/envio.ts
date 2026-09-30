import "server-only";

import { transacao, type EscopoDb } from "@/lib/db";
import { emailValido, enviarEmail, esc } from "@/lib/email";
import { formatarData } from "@/lib/formato";
import { urlRespostaNr1 } from "./links";

type Org = { nome: string; corMarca: string | null; logoUrl: string | null; minimoRecorte: number };
type Ciclo = { titulo: string; descricao: string | null; mensagemConvite: string | null; encerraEm: Date | null };

const COR_PADRAO = "#0B1F3A";
const corSegura = (c: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : COR_PADRAO);
const logoSeguro = (u: string | null) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

/** Explicação de privacidade — a MESMA exibida na página de resposta (corresponde à implementação). */
export const privacidadeNr1 = (minimo: number) =>
  "O link é pessoal apenas para impedir respostas duplicadas. Registramos que o convite foi usado, mas as respostas são gravadas separadamente, " +
  `sem seu nome, e-mail ou link, e sem data e hora. A empresa vê somente resultados agregados, com no mínimo ${minimo} respostas por recorte; grupos menores não são exibidos.`;

/** E-mail white-label (logo e cor da organização; remetente configurado em EMAIL_REMETENTE). */
export function emailConviteNr1(org: Org, c: Ciclo, nome: string, link: string, lembrete: boolean) {
  const cor = corSegura(org.corMarca);
  const logo = logoSeguro(org.logoUrl);
  const primeiro = nome.split(" ")[0];
  const prazo = c.encerraEm ? `Prazo para responder: ${formatarData(c.encerraEm)}.` : "";
  const assunto = `${lembrete ? "Lembrete: " : ""}${c.titulo} — ${org.nome}`;
  const abertura = lembrete
    ? `Se você ainda não respondeu “${c.titulo}”, sua participação continua importante.`
    : `${org.nome} convida você a responder “${c.titulo}”, uma pesquisa sobre as condições e a organização do trabalho.`;
  const texto = [`Olá, ${primeiro}.`, "", abertura, c.mensagemConvite ?? c.descricao ?? "", prazo, "", privacidadeNr1(org.minimoRecorte), "", `Responder: ${link}`, "O link é pessoal e vale para uma única resposta — não o encaminhe."].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1F3A">
    <div style="background:${cor};padding:20px 24px;border-radius:12px 12px 0 0">
      ${logo ? `<img src="${esc(logo)}" alt="${esc(org.nome)}" style="max-height:36px">` : `<strong style="color:#fff;font-size:18px">${esc(org.nome)}</strong>`}
    </div>
    <div style="border:1px solid #E2E8EE;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Olá, ${esc(primeiro)}.</p>
      <p>${esc(abertura)}</p>
      ${c.mensagemConvite || c.descricao ? `<p style="color:#526173;white-space:pre-line">${esc(c.mensagemConvite ?? c.descricao ?? "")}</p>` : ""}
      ${prazo ? `<p><strong>${esc(prazo)}</strong></p>` : ""}
      <p style="color:#526173;font-size:13px">${esc(privacidadeNr1(org.minimoRecorte))}</p>
      <p style="margin:28px 0"><a href="${esc(link)}" style="background:${cor};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Responder pesquisa</a></p>
      <p style="color:#526173;font-size:12px">O link é pessoal e vale para uma única resposta — não o encaminhe. Enviado pelo JourneyLab em nome de ${esc(org.nome)}.</p>
    </div></div>`;
  return { assunto, texto, html };
}

export type ResultadoEnvioNr1 = { enviados: number; falhas: { nome: string; motivo: string }[]; semEmail: number };

/**
 * Envia convites (ou lembretes). No convite fica só o controle de envio (data do
 * envio/erro); lembretes não são registrados por pessoa — a tela mostra só totais.
 */
export async function enviarConvitesNr1(escopo: EscopoDb, conviteIds: string[], lembrete: boolean): Promise<ResultadoEnvioNr1> {
  const r: ResultadoEnvioNr1 = { enviados: 0, falhas: [], semEmail: 0 };
  if (!conviteIds.length) return r;
  const itens = await transacao(escopo, (tx) =>
    tx.conviteNr1.findMany({
      where: { id: { in: conviteIds } },
      select: { id: true, colaboradorId: true, ciclo: { select: { tenantId: true, titulo: true, descricao: true, mensagemConvite: true, encerraEm: true } } },
    }),
  );
  if (!itens.length) return r;
  const dados = await transacao(escopo, async (tx) => ({
    org: await tx.organizacao.findUniqueOrThrow({ where: { id: itens[0].ciclo.tenantId }, select: { nome: true, corMarca: true, logoUrl: true, minimoRecorte: true } }),
    pessoas: await tx.colaborador.findMany({
      where: { id: { in: itens.map((i) => i.colaboradorId) } },
      select: { id: true, nome: true, email: true, associacao: { select: { status: true, usuario: { select: { email: true } } } } },
    }),
  }));
  for (const c of itens) {
    const pessoa = dados.pessoas.find((p) => p.id === c.colaboradorId);
    const email = pessoa ? (pessoa.associacao?.status === "ativa" ? pessoa.associacao.usuario.email : pessoa.email) : null;
    let erro: string | null = null;
    if (!pessoa || !emailValido(email)) {
      erro = "Sem e-mail válido no cadastro.";
      r.semEmail++;
    } else {
      const m = emailConviteNr1(dados.org, c.ciclo, pessoa.nome, urlRespostaNr1(c.id), lembrete);
      try {
        await enviarEmail({ para: email!, assunto: m.assunto, texto: m.texto, html: m.html });
        r.enviados++;
      } catch (e) {
        erro = e instanceof Error ? e.message : "Falha no envio.";
        r.falhas.push({ nome: pessoa.nome, motivo: erro });
      }
    }
    // Lembretes não tocam no convite: registrar erro/envio por pessoa revelaria quem ainda não respondeu.
    if (!lembrete) await transacao(escopo, (tx) => tx.conviteNr1.update({ where: { id: c.id }, data: erro ? { erro } : { enviadoEm: new Date(), erro: null } }));
  }
  return r;
}
