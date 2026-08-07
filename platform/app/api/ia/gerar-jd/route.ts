import { NextResponse } from "next/server";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { createIaClient, parseJsonDaResposta, MODELO_IA } from "@/modules/ia/client";
import { senioridadeLabel, modeloTrabalhoLabel } from "@/modules/ats/schemas";

type Payload = {
  cargo: string;
  senioridade?: string | null;
  stack?: string[];
  modeloTrabalho?: string | null;
  empresaId: string;
};

type RespostaIa = { jobDescription: string; skillsSugeridas: string[] };

/** POST /api/ia/gerar-jd — docs/business-platform/apis.md. Rascunho: o
 * recrutador sempre revisa/edita antes de salvar (o campo só é persistido
 * quando o form da vaga é submetido), então não guarda trilha de auditoria
 * própria — diferente de score/matching, que gravam uma decisão direto. */
export async function POST(request: Request) {
  await requirePapel(PAPEIS_ATS);
  const body = (await request.json()) as Payload;

  if (!body.cargo || !body.empresaId) {
    return NextResponse.json({ erro: "Informe ao menos o cargo e a empresa." }, { status: 400 });
  }

  const empresa = await prisma.empresa.findUnique({ where: { id: body.empresaId }, select: { nome: true } });

  const senioridade = body.senioridade ? senioridadeLabel[body.senioridade as keyof typeof senioridadeLabel] : null;
  const modeloTrabalho = body.modeloTrabalho
    ? modeloTrabalhoLabel[body.modeloTrabalho as keyof typeof modeloTrabalhoLabel]
    : null;

  const prompt = `Você é redator de vagas da Find4You, consultoria de Recruitment & Executive Search. Tom consultivo, sofisticado, orientado a negócios — nunca genérico ou "startup casual".

Escreva a Job Description para esta vaga:
- Cargo: ${body.cargo}
- Empresa cliente: ${empresa?.nome ?? "não informado"}
${senioridade ? `- Senioridade: ${senioridade}\n` : ""}${modeloTrabalho ? `- Modelo de trabalho: ${modeloTrabalho}\n` : ""}${
    body.stack?.length ? `- Stack técnica: ${body.stack.join(", ")}\n` : ""
  }
Responda em português, só com um objeto JSON válido, sem markdown, no formato:
{"jobDescription": "texto corrido da JD, 3-5 parágrafos", "skillsSugeridas": ["skill1", "skill2", ...]}`;

  const client = createIaClient();
  const message = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const resposta = parseJsonDaResposta<RespostaIa>(message);
  return NextResponse.json(resposta);
}
