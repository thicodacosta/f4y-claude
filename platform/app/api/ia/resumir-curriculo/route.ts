import { NextResponse } from "next/server";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { createIaClient, textoDaResposta, MODELO_IA } from "@/modules/ia/client";

type Payload = { candidatoId: string };

/** POST /api/ia/resumir-curriculo — docs/business-platform/apis.md. Persiste
 * resumo_ia + score_ia_modelo/score_ia_gerado_em (mesmos campos de auditoria
 * de IA do candidato, reaproveitados aqui — ver comentário no schema). */
export async function POST(request: Request) {
  await requirePapel(PAPEIS_ATS);
  const { candidatoId } = (await request.json()) as Payload;

  const candidato = await prisma.candidato.findUnique({ where: { id: candidatoId } });
  if (!candidato) {
    return NextResponse.json({ erro: "Candidato não encontrado." }, { status: 404 });
  }

  const prompt = `Você é analista de recrutamento da Find4You. Escreva um resumo profissional, objetivo e consultivo (3-5 frases, em português) deste candidato, para um recrutador avaliar rapidamente o fit dele em processos seletivos. Não invente informações que não estão nos dados abaixo.

Nome: ${candidato.nome}
Cargo atual: ${candidato.cargoAtual ?? "não informado"}
Empresa atual: ${candidato.empresaAtual ?? "não informado"}
Skills: ${candidato.skills.join(", ") || "não informado"}
Tecnologias: ${candidato.tecnologias.join(", ") || "não informado"}
Idiomas: ${candidato.idiomas.join(", ") || "não informado"}
Certificações: ${candidato.certificacoes.join(", ") || "não informado"}
Experiências: ${JSON.stringify(candidato.experiencias)}
Formação: ${JSON.stringify(candidato.formacao)}

Responda só com o texto do resumo, sem markdown, sem título.`;

  const client = createIaClient();
  const message = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const resumo = textoDaResposta(message).trim();
  const geradoEm = new Date();

  await prisma.candidato.update({
    where: { id: candidatoId },
    data: { resumoIa: resumo, scoreIaModelo: MODELO_IA, scoreIaGeradoEm: geradoEm },
  });

  return NextResponse.json({ resumo, modelo: MODELO_IA, geradoEm: geradoEm.toISOString() });
}
