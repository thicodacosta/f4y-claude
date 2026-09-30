import "server-only";

import { transacao, type EscopoDb } from "@/lib/db";
import { emailValido, enviarEmail, esc } from "@/lib/email";
import { formatarData } from "@/lib/formato";
import { tokenDoConvite, urlResposta } from "./links";

type Org = { nome: string; corMarca: string | null; logoUrl: string | null };
type Pesquisa = { id: string; titulo: string; descricao: string | null; anonima: boolean; encerraEm: Date | null };

const COR_PADRAO = "#0B1F3A";
const corSegura = (c: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : COR_PADRAO);
const logoSeguro = (u: string | null) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

/** E-mail white-label: logo e cor da organização (com fallback para a marca JourneyLab). */
export function emailPesquisa(org: Org, p: Pesquisa, nome: string, link: string, lembrete: boolean) {
  const cor = corSegura(org.corMarca);
  const logo = logoSeguro(org.logoUrl);
  const primeiro = nome.split(" ")[0];
  const prazo = p.encerraEm ? ` até ${formatarData(p.encerraEm)}` : "";
  const assunto = `${lembrete ? "Lembrete: " : ""}${p.titulo} — ${org.nome}`;
  const anonimato = p.anonima
    ? "Suas respostas são anônimas: não guardamos quem respondeu cada resposta nem quando, e os resultados só aparecem agregados."
    : "Esta pesquisa é identificada: suas respostas ficam associadas ao seu nome.";
  const texto = [
    `Olá, ${primeiro}.`,
    "",
    lembrete ? `Ainda não recebemos sua resposta para “${p.titulo}”.` : `${org.nome} convida você para responder “${p.titulo}”${prazo}.`,
    p.descricao ?? "",
    anonimato,
    "",
    `Responder: ${link}`,
    "O link é pessoal — não o encaminhe.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1F3A">
    <div style="background:${cor};padding:20px 24px;border-radius:12px 12px 0 0">
      ${logo ? `<img src="${esc(logo)}" alt="${esc(org.nome)}" style="max-height:36px">` : `<strong style="color:#fff;font-size:18px">${esc(org.nome)}</strong>`}
    </div>
    <div style="border:1px solid #E2E8EE;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Olá, ${esc(primeiro)}.</p>
      <p>${lembrete ? `Ainda não recebemos sua resposta para <strong>${esc(p.titulo)}</strong>.` : `${esc(org.nome)} convida você para responder <strong>${esc(p.titulo)}</strong>${esc(prazo)}.`}</p>
      ${p.descricao ? `<p style="color:#526173">${esc(p.descricao)}</p>` : ""}
      <p style="color:#526173;font-size:13px">${esc(anonimato)}</p>
      <p style="margin:28px 0"><a href="${esc(link)}" style="background:${cor};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Responder Pesquisa</a></p>
      <p style="color:#526173;font-size:12px">O link é pessoal — não o encaminhe. Enviado pelo JourneyLab em nome de ${esc(org.nome)}.</p>
    </div></div>`;
  return { assunto, texto, html };
}

export type ResultadoEnvio = { enviados: number; falhas: { nome: string; motivo: string }[]; semEmail: number };

/**
 * Envia convites (ou lembretes) por e-mail com o link pessoal de cada pessoa.
 * O destinatário é o e-mail da conta da pessoa na plataforma ou, na falta, o do
 * cadastro. Cada falha é gravada no convite e devolvida para a tela.
 */
export async function enviarConvites(escopo: EscopoDb, conviteIds: string[], lembrete: boolean): Promise<ResultadoEnvio> {
  const itens = await transacao(escopo, (tx) =>
    tx.convitePulse.findMany({
      where: { id: { in: conviteIds } },
      include: {
        pesquisa: { select: { id: true, titulo: true, descricao: true, anonima: true, encerraEm: true, tenantId: true } },
      },
    }),
  );
  if (!itens.length) return { enviados: 0, falhas: [], semEmail: 0 };
  const dados = await transacao(escopo, async (tx) => ({
    org: await tx.organizacao.findUniqueOrThrow({ where: { id: itens[0].pesquisa.tenantId }, select: { nome: true, corMarca: true, logoUrl: true } }),
    pessoas: await tx.colaborador.findMany({
      where: { id: { in: itens.map((i) => i.colaboradorId) } },
      select: { id: true, nome: true, email: true, associacao: { select: { status: true, usuario: { select: { email: true } } } } },
    }),
  }));
  const r: ResultadoEnvio = { enviados: 0, falhas: [], semEmail: 0 };
  for (const c of itens) {
    const pessoa = dados.pessoas.find((p) => p.id === c.colaboradorId);
    const email = pessoa ? (pessoa.associacao?.status === "ativa" ? pessoa.associacao.usuario.email : pessoa.email) : null;
    let erro: string | null = null;
    if (!pessoa || !emailValido(email)) {
      erro = "Sem e-mail válido no cadastro.";
      r.semEmail++;
    } else {
      const m = emailPesquisa(dados.org, c.pesquisa, pessoa.nome, urlResposta(c.pesquisaId, tokenDoConvite(c.id)), lembrete);
      try {
        await enviarEmail({ para: email!, assunto: m.assunto, texto: m.texto, html: m.html });
        r.enviados++;
      } catch (e) {
        erro = e instanceof Error ? e.message : "Falha no envio.";
        r.falhas.push({ nome: pessoa.nome, motivo: erro });
      }
    }
    await transacao(escopo, (tx) =>
      tx.convitePulse.update({ where: { id: c.id }, data: erro ? { erro } : lembrete ? { lembreteEm: new Date(), erro: null } : { enviadoEm: new Date(), erro: null } }),
    );
  }
  return r;
}
