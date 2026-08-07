import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePortalCandidato } from "@/lib/auth";

export async function getMeusProcessos() {
  const { candidatoId } = await requirePortalCandidato();

  const processos = await prisma.vagaCandidato.findMany({
    where: { candidatoId },
    include: { vaga: { include: { empresa: true } } },
    orderBy: { criadoEm: "desc" },
  });

  return processos.map((p) => ({
    id: p.id,
    etapa: p.etapa,
    // Mesma regra de confidencialidade do ATS interno (fluxos-usuario.md #3):
    // um processo confidencial não revela o nome do cliente nem ao próprio
    // candidato.
    cargo: p.vaga.cargo,
    empresaNome: p.vaga.confidencial ? "Cliente confidencial" : p.vaga.empresa.nome,
    vertical: p.vaga.vertical,
    criadoEm: p.criadoEm.toISOString(),
  }));
}

export async function getMeuPerfil() {
  const { candidatoId } = await requirePortalCandidato();

  const candidato = await prisma.candidato.findUniqueOrThrow({ where: { id: candidatoId } });

  return {
    id: candidato.id,
    nome: candidato.nome,
    email: candidato.email,
    telefone: candidato.telefone,
    whatsapp: candidato.whatsapp,
    linkedin: candidato.linkedin,
    github: candidato.github,
    portfolioUrl: candidato.portfolioUrl,
    curriculoUrl: candidato.curriculoUrl,
    cidade: candidato.cidade,
    estado: candidato.estado,
    pretensaoSalarial: candidato.pretensaoSalarial ? Number(candidato.pretensaoSalarial) : null,
    disponibilidade: candidato.disponibilidade,
    skills: candidato.skills,
  };
}

export async function getMinhasEdicoesPendentes() {
  const { candidatoId } = await requirePortalCandidato();

  const edicoes = await prisma.edicaoPerfilPendente.findMany({
    where: { candidatoId },
    orderBy: { criadoEm: "desc" },
    take: 10,
  });

  return edicoes.map((e) => ({
    id: e.id,
    campos: e.campos as Record<string, unknown>,
    status: e.status,
    criadoEm: e.criadoEm.toISOString(),
  }));
}
