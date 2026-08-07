import { NextResponse } from "next/server";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { createIaClient, parseJsonDaResposta, MODELO_IA } from "@/modules/ia/client";

type Payload = { vagaId: string };
type Sugestao = { candidatoId: string; score: number; justificativa: string };

const TAMANHO_POOL = 30;
const MAX_SUGESTOES = 5;

/** POST /api/ia/matching — docs/business-platform/apis.md. Só sugere
 * candidatos que ainda NÃO estão no pipeline desta vaga; a auditoria
 * (VagaCandidato.fitScore*) só é persistida se o recrutador realmente
 * adicionar a sugestão (ver modules/ats/actions.ts#adicionarCandidatoAVaga),
 * não para sugestões descartadas — evita uma tabela só para log de
 * sugestões nunca usadas. */
export async function POST(request: Request) {
  await requirePapel(PAPEIS_ATS);
  const { vagaId } = (await request.json()) as Payload;

  const vaga = await prisma.vaga.findUnique({ where: { id: vagaId } });
  if (!vaga) {
    return NextResponse.json({ erro: "Vaga não encontrada." }, { status: 404 });
  }

  const jaNoPipeline = await prisma.vagaCandidato.findMany({
    where: { vagaId },
    select: { candidatoId: true },
  });
  const idsExcluidos = jaNoPipeline.map((vc) => vc.candidatoId);

  const pool = await prisma.candidato.findMany({
    where: { id: { notIn: idsExcluidos }, status: { in: ["ativo", "em_processo"] } },
    orderBy: { atualizadoEm: "desc" },
    take: TAMANHO_POOL,
  });

  if (pool.length === 0) {
    return NextResponse.json({ candidatos: [] });
  }

  const listaCandidatos = pool
    .map(
      (c, i) =>
        `${i + 1}. id="${c.id}" | ${c.nome} | ${c.cargoAtual ?? "—"} | skills: ${c.skills.join(", ") || "—"} | tecnologias: ${c.tecnologias.join(", ") || "—"}`,
    )
    .join("\n");

  const prompt = `Você é analista de recrutamento da Find4You. Entre os candidatos abaixo, escolha os até ${MAX_SUGESTOES} com maior aderência a esta vaga.

Vaga: ${vaga.cargo}${vaga.senioridade ? ` (${vaga.senioridade})` : ""}
Stack requerida: ${vaga.stackTecnologica.join(", ") || "não informado"}
Skills requeridas: ${vaga.skillsRequeridas.join(", ") || "não informado"}
Job description: ${vaga.jobDescription ?? "não informado"}

Candidatos disponíveis:
${listaCandidatos}

Responda só com um objeto JSON válido, sem markdown, com os candidatos ORDENADOS do maior pro menor score:
{"candidatos": [{"candidatoId": "id exato da lista", "score": 0-100, "justificativa": "1 frase"}]}`;

  const client = createIaClient();
  const message = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const resposta = parseJsonDaResposta<{ candidatos: Sugestao[] }>(message);

  const idsValidos = new Set(pool.map((c) => c.id));
  const candidatosPorId = new Map(pool.map((c) => [c.id, c]));
  const sugestoes = resposta.candidatos
    .filter((s) => idsValidos.has(s.candidatoId))
    .map((s) => {
      const c = candidatosPorId.get(s.candidatoId)!;
      return {
        candidatoId: s.candidatoId,
        score: s.score,
        justificativa: s.justificativa,
        nome: c.nome,
        cargoAtual: c.cargoAtual,
        skills: c.skills,
      };
    });

  return NextResponse.json({ candidatos: sugestoes, modelo: MODELO_IA });
}
