import { NextResponse } from "next/server";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { createIaClient, parseJsonDaResposta, MODELO_IA } from "@/modules/ia/client";

type Payload = { candidatoId: string; vagaId?: string };
type Fatores = { tecnico: number; comportamental: number; aderenciaStack: number };
type RespostaIa = { score: number; fatores: Fatores; justificativa: string };

/** POST /api/ia/score-candidato — docs/business-platform/apis.md.
 * `vagaId` ausente → score geral do candidato (Candidato.scoreIa*);
 * `vagaId` presente → score de aderência a ESSA vaga (VagaCandidato.fitScore*
 * — exige que o candidato já esteja no pipeline da vaga). */
export async function POST(request: Request) {
  await requirePapel(PAPEIS_ATS);
  const { candidatoId, vagaId } = (await request.json()) as Payload;

  const candidato = await prisma.candidato.findUnique({ where: { id: candidatoId } });
  if (!candidato) {
    return NextResponse.json({ erro: "Candidato não encontrado." }, { status: 404 });
  }

  const vaga = vagaId ? await prisma.vaga.findUnique({ where: { id: vagaId } }) : null;
  if (vagaId && !vaga) {
    return NextResponse.json({ erro: "Vaga não encontrada." }, { status: 404 });
  }

  const perfilCandidato = `Cargo atual: ${candidato.cargoAtual ?? "não informado"}
Skills: ${candidato.skills.join(", ") || "não informado"}
Tecnologias: ${candidato.tecnologias.join(", ") || "não informado"}
Pretensão salarial: ${candidato.pretensaoSalarial ?? "não informado"}
Experiências: ${JSON.stringify(candidato.experiencias)}`;

  const prompt = vaga
    ? `Você é analista de recrutamento da Find4You. Avalie a aderência deste candidato a ESTA vaga específica.

Vaga: ${vaga.cargo}${vaga.senioridade ? ` (${vaga.senioridade})` : ""}
Stack requerida: ${vaga.stackTecnologica.join(", ") || "não informado"}
Skills requeridas: ${vaga.skillsRequeridas.join(", ") || "não informado"}
Job description: ${vaga.jobDescription ?? "não informado"}

Candidato:
${perfilCandidato}

Responda só com um objeto JSON válido, sem markdown:
{"score": 0-100, "fatores": {"tecnico": 0-100, "comportamental": 0-100, "aderenciaStack": 0-100}, "justificativa": "1-2 frases explicando a nota"}`
    : `Você é analista de recrutamento da Find4You. Avalie a empregabilidade geral deste candidato no mercado de tecnologia (não é para uma vaga específica).

Candidato:
${perfilCandidato}

Responda só com um objeto JSON válido, sem markdown:
{"score": 0-100, "fatores": {"tecnico": 0-100, "comportamental": 0-100, "aderenciaStack": 0-100}, "justificativa": "1-2 frases explicando a nota"}`;

  const client = createIaClient();
  const message = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const resposta = parseJsonDaResposta<RespostaIa>(message);
  const geradoEm = new Date();

  if (vagaId) {
    const vagaCandidato = await prisma.vagaCandidato.findUnique({
      where: { vagaId_candidatoId: { vagaId, candidatoId } },
    });
    if (!vagaCandidato) {
      return NextResponse.json(
        { erro: "Candidato ainda não está no pipeline desta vaga — adicione-o antes de calcular o score." },
        { status: 400 },
      );
    }
    await prisma.vagaCandidato.update({
      where: { id: vagaCandidato.id },
      data: {
        fitScore: resposta.score,
        fitScoreJustificativa: resposta.justificativa,
        fitScoreModelo: MODELO_IA,
        fitScoreGeradoEm: geradoEm,
      },
    });
  } else {
    await prisma.candidato.update({
      where: { id: candidatoId },
      data: { scoreIa: resposta.score, scoreIaModelo: MODELO_IA, scoreIaGeradoEm: geradoEm },
    });
  }

  return NextResponse.json(resposta);
}
