"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { dentroDoLimite } from "@/lib/limite";
import { formatarDataHora } from "@/lib/formato";
import { enviarArquivo, removerArquivo, tipoRealCurriculo } from "@/lib/storage";
import { normalizarEmail, normalizarTelefone, normalizarTexto } from "@/lib/crm/normalizar";
import { SISTEMA } from "@/lib/integracoes/processar";
import { enviarAvisoCandidatura, plataformaCarreiras } from "./notificacao";
import { orgPublica } from "./publico";
import { recebeCandidaturas, TAMANHO_CURRICULO, TIPOS_CANDIDATURA } from "./regras";

export type RespostaCandidatura = { ok?: boolean; erro?: string; campos?: Record<string, string> };

const ORIGEM = "Página de Carreiras";
const dadosSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().max(200).email("Informe um e-mail válido."),
  telefone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => (v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 13), "Informe um telefone com DDD."),
});

/**
 * Candidatura pública (sem login). A organização é derivada da VAGA validada no
 * servidor (slug da organização + slug da vaga), nunca de um id enviado pelo
 * navegador. Ordem: validações → arquivo no bucket privado → UMA transação
 * (candidato novo ou existente pelo e-mail, currículo, candidatura, histórico) →
 * aviso ao criador. Se a transação falhar, o arquivo enviado é removido; se o
 * e-mail falhar, tudo permanece registrado com o aviso "falhou" para reenvio.
 */
export async function candidatar(orgSlug: string, vagaSlug: string, fd: FormData): Promise<RespostaCandidatura> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!dentroDoLimite(`carreiras:ip:${ip}`, 20, 10 * 60_000)) return { erro: "Muitas candidaturas enviadas em sequência. Aguarde alguns minutos e tente novamente." };
  // Campo-armadilha (invisível para pessoas): preenchido = envio automatizado.
  if (String(fd.get("site") ?? "").trim()) return { erro: "Não foi possível enviar a candidatura." };

  const parse = dadosSchema.safeParse({ nome: fd.get("nome") ?? "", email: fd.get("email") ?? "", telefone: fd.get("telefone") ?? "" });
  if (!parse.success) {
    const campos = Object.fromEntries(parse.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { erro: parse.error.issues[0].message, campos };
  }
  const d = parse.data;
  const arquivo = fd.get("curriculo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Anexe seu currículo em PDF ou DOCX.", campos: { curriculo: "Anexe seu currículo." } };
  if (arquivo.size > TAMANHO_CURRICULO) return { erro: "O currículo deve ter no máximo 10 MB.", campos: { curriculo: "Máximo de 10 MB." } };
  const ext = arquivo.name.toLowerCase().split(".").pop();
  const real = await tipoRealCurriculo(arquivo);
  const mime = real === "application/pdf" && ext === "pdf" ? real : real?.includes("wordprocessingml") && ext === "docx" ? real : null;
  if (!mime || !TIPOS_CANDIDATURA[mime]) return { erro: "Formato não aceito. Envie o currículo em PDF ou DOCX.", campos: { curriculo: "Envie PDF ou DOCX." } };

  const org = await orgPublica(orgSlug);
  if (!org) return { erro: "Página de carreiras indisponível." };
  const vaga = await transacao(plataformaCarreiras, (tx) =>
    tx.vaga.findUnique({ where: { tenantId_slug: { tenantId: org.id, slug: vagaSlug } }, select: { id: true, tenantId: true, titulo: true, publicada: true, status: true } }),
  );
  if (!vaga || vaga.tenantId !== org.id) return { erro: "Vaga não encontrada." };
  if (!recebeCandidaturas(vaga)) return { erro: "Esta vaga não está recebendo candidaturas." };
  if (!dentroDoLimite(`carreiras:email:${vaga.id}:${d.email}`, 3, 60 * 60_000)) return { erro: "Você já enviou esta candidatura várias vezes na última hora. Aguarde para tentar novamente." };

  const tenantId = vaga.tenantId;
  let caminho: string;
  try {
    caminho = await enviarArquivo(tenantId, "crm/carreiras", arquivo);
  } catch {
    return { erro: "Não foi possível receber o currículo agora. Tente novamente em instantes." };
  }

  let candidaturaId: string;
  try {
    candidaturaId = await transacao(plataformaCarreiras, async (tx) => {
      const emailNorm = normalizarEmail(d.email)!;
      const telefoneNorm = normalizarTelefone(d.telefone);
      const agora = new Date();
      const autor = { autorId: null, autorNome: ORIGEM };
      let candidato = await tx.candidato.findFirst({ where: { tenantId, emailNorm }, orderBy: { criadoEm: "asc" } });
      const notas: string[] = [];
      if (!candidato) {
        candidato = await tx.candidato.create({
          data: {
            tenantId,
            nome: d.nome,
            email: d.email,
            telefone: d.telefone,
            origem: ORIGEM,
            baseLegal: "Dados e currículo enviados pelo próprio titular em candidatura pela Página de Carreiras.",
            nomeNorm: normalizarTexto(d.nome),
            emailNorm,
            telefoneNorm,
            criadoPor: ORIGEM,
          },
        });
        await tx.interacaoCandidato.create({ data: { tenantId, candidatoId: candidato.id, tipo: "sistema", texto: "Cadastro criado automaticamente pela Página de Carreiras.", ...autor } });
      } else {
        // Contato existente: preenche o que faltava, sem apagar dados anteriores.
        const atualizar: { telefone?: string; telefoneNorm?: string | null } = {};
        if (!candidato.telefone) Object.assign(atualizar, { telefone: d.telefone, telefoneNorm });
        else if (telefoneNorm && candidato.telefoneNorm !== telefoneNorm) notas.push(`telefone informado nesta candidatura: ${d.telefone}`);
        if (normalizarTexto(d.nome) !== candidato.nomeNorm) notas.push(`nome informado nesta candidatura: ${d.nome}`);
        if (Object.keys(atualizar).length) candidato = await tx.candidato.update({ where: { id: candidato.id }, data: atualizar });
      }
      const anexo = await tx.anexoCandidato.create({
        data: { tenantId, candidatoId: candidato.id, tipo: "curriculo", nomeArquivo: arquivo.name.slice(0, 200), caminho, tamanho: arquivo.size, mime, enviadoPor: `${ORIGEM} (candidato)` },
      });
      const existente = await tx.candidatura.findUnique({ where: { vagaId_candidatoId: { vagaId: vaga.id, candidatoId: candidato.id } } });
      const cand = existente
        ? await tx.candidatura.update({ where: { id: existente.id }, data: { anexoId: anexo.id, origem: "carreiras", notificacaoStatus: "pendente", notificacaoErro: null } })
        : await tx.candidatura.create({ data: { tenantId, vagaId: vaga.id, candidatoId: candidato.id, origem: "carreiras", anexoId: anexo.id, notificacaoStatus: "pendente" } });
      await tx.interacaoCandidato.create({
        data: {
          tenantId,
          candidatoId: candidato.id,
          tipo: "sistema",
          texto: `${existente ? "Nova candidatura (reenvio)" : "Candidatura"} pela Página de Carreiras para a vaga “${vaga.titulo}” em ${formatarDataHora(agora.toISOString())}. Currículo: ${arquivo.name}.${notas.length ? ` Diferenças mantidas no histórico: ${notas.join("; ")}.` : ""}`,
          ...autor,
        },
      });
      await auditar(tx, { tenantId, usuario: { id: SISTEMA, nome: ORIGEM }, acao: "carreiras.candidatura", entidade: "candidatura", entidadeId: cand.id, detalhes: { vagaId: vaga.id, reenvio: !!existente } });
      return cand.id;
    });
  } catch {
    await removerArquivo(caminho).catch(() => undefined);
    return { erro: "Não foi possível registrar sua candidatura. Nada foi salvo — tente novamente em instantes." };
  }

  // Aviso ao criador: falha não desfaz nem duplica a candidatura (fica "falhou" para reenvio).
  await enviarAvisoCandidatura(candidaturaId).catch(() => undefined);
  return { ok: true };
}
