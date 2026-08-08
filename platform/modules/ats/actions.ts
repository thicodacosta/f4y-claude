"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS, PAPEIS_CRM } from "@/lib/roles";
import {
  criarVagaSchema,
  moverVagaSchema,
  fecharVagaSchema,
  atualizarVagaSchema,
  criarCandidatoSchema,
  adicionarCandidatoVagaSchema,
  moverCandidatoVagaSchema,
  csvToArray,
  type CriarVagaFormInput,
  type FecharVagaFormInput,
  type CriarCandidatoFormInput,
  type AtualizarVagaFormInput,
} from "@/modules/ats/schemas";
import { serializeVaga, serializeCandidato, serializeVagaCandidato } from "@/modules/ats/serialize";
import { getCandidatos, assertPodeAcessarVaga, podeVerConfidencial } from "@/modules/ats/queries";
import { gerarFaturamentoEComissao } from "@/modules/financeiro/comissoes";
import { dispararEntrouEtapa } from "@/modules/automacoes/engine";

function revalidateAts() {
  revalidatePath("/ats/pipeline-vagas");
  revalidatePath("/vagas");
  revalidatePath("/candidatos");
}

export async function criarVaga(input: CriarVagaFormInput) {
  await requirePapel(PAPEIS_ATS);
  const data = criarVagaSchema.parse(input);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "vagas" },
    include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
  });
  const primeiraEtapa = pipeline?.etapas[0];
  if (!primeiraEtapa) {
    throw new Error("Pipeline de Vagas sem etapas — rode prisma/seed.sql.");
  }

  const vaga = await prisma.$transaction(async (tx) => {
    let empresaId = data.empresaId;
    if (!empresaId && data.empresaNovaNome) {
      const empresa = await tx.empresa.create({ data: { nome: data.empresaNovaNome } });
      empresaId = empresa.id;
    }
    if (!empresaId) throw new Error("Empresa não informada.");

    const criada = await tx.vaga.create({
      data: {
        empresaId,
        oportunidadeOrigemId: data.oportunidadeOrigemId,
        etapaId: primeiraEtapa.id,
        cargo: data.cargo,
        vertical: data.vertical,
        quantidadePosicoes: data.quantidadePosicoes,
        prioridade: data.prioridade,
        modeloTrabalho: data.modeloTrabalho,
        senioridade: data.senioridade,
        cidade: data.cidade,
        estado: data.estado,
        salarioMin: data.salarioMin,
        salarioMax: data.salarioMax,
        stackTecnologica: csvToArray(data.stackTecnologica),
        jobDescription: data.jobDescription,
        confidencial: data.confidencial,
        executiveSearch: data.executiveSearch,
      },
      include: { empresa: true },
    });

    // Engine de automações (Fase 5) — a vaga já nasce na primeira etapa
    // (Abertas), então "entrou_etapa" dispara aqui, não só no moverVaga.
    await dispararEntrouEtapa(tx, primeiraEtapa.id, {
      entidadeTipo: "vaga",
      entidadeId: criada.id,
      responsavelId: criada.recrutadorId,
    });

    return criada;
  });

  revalidateAts();
  return serializeVaga(vaga);
}

export async function moverVaga(input: { vagaId: string; novaEtapaId: string }) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = moverVagaSchema.parse(input);
  await assertPodeAcessarVaga(usuario.papel, data.vagaId);

  const novaEtapa = await prisma.pipelineEtapa.findUnique({ where: { id: data.novaEtapaId } });
  if (!novaEtapa) throw new Error("Etapa de destino não encontrada.");

  await prisma.$transaction(async (tx) => {
    const etapaAnterior = await tx.vaga.findUniqueOrThrow({
      where: { id: data.vagaId },
      include: { etapa: true },
    });

    const vaga = await tx.vaga.update({
      where: { id: data.vagaId },
      data: {
        etapaId: novaEtapa.id,
        status: novaEtapa.isGanho
          ? "fechada"
          : novaEtapa.isPerdido
            ? "perdida"
            : novaEtapa.isPausada
              ? "pausada"
              : "aberta",
        fechadoEm: novaEtapa.isGanho || novaEtapa.isPerdido ? new Date() : null,
      },
    });

    // Log na timeline — além de auditoria, é a referência que a verificação
    // de SLA (modules/automacoes/sla.ts) usa pra saber há quanto tempo a
    // vaga está na etapa atual (não tinha antes desta fase).
    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: data.vagaId,
        tipo: "mudanca_etapa",
        autorId: usuario.id,
        conteudo: `Movida de "${etapaAnterior.etapa.nome}" para "${novaEtapa.nome}".`,
      },
    });

    // Fluxo financeiro (fluxos-usuario.md #5, passo 1): fechamento de vaga
    // gera lançamento pendente de faturamento + comissão do recrutador.
    if (novaEtapa.isGanho) {
      await gerarFaturamentoEComissao(tx, {
        empresaId: vaga.empresaId,
        origemTipo: "vaga",
        origemId: vaga.id,
        valor: vaga.valor ? Number(vaga.valor) : 0,
        vertical: vaga.vertical,
        usuarioId: vaga.recrutadorId,
      });
    }

    // Engine de automações (Fase 5) — ver mesmo gancho em
    // modules/crm/actions.ts#moverOportunidade.
    await dispararEntrouEtapa(tx, novaEtapa.id, {
      entidadeTipo: "vaga",
      entidadeId: vaga.id,
      responsavelId: vaga.recrutadorId,
    });
  });

  revalidateAts();
  revalidatePath(`/vagas/${data.vagaId}`);
}

/** Fase 11 — versão de moverVaga usada quando a etapa de destino é Ganho
 * (ver components/ats/fechar-vaga-dialog.tsx, que intercepta o drag-and-drop
 * do Kanban antes de chegar aqui). Separada de moverVaga em vez de receber
 * um parâmetro opcional porque os dois fluxos têm formulário e validação bem
 * diferentes — só compartilham gerarFaturamentoEComissao/dispararEntrouEtapa. */
export async function fecharVaga(input: FecharVagaFormInput) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = fecharVagaSchema.parse(input);
  await assertPodeAcessarVaga(usuario.papel, data.vagaId);

  const novaEtapa = await prisma.pipelineEtapa.findUnique({ where: { id: data.novaEtapaId } });
  if (!novaEtapa || !novaEtapa.isGanho) {
    throw new Error("Etapa de destino precisa ser uma etapa de Ganho.");
  }

  await prisma.$transaction(async (tx) => {
    const etapaAnterior = await tx.vaga.findUniqueOrThrow({
      where: { id: data.vagaId },
      include: { etapa: true },
    });

    const vaga = await tx.vaga.update({
      where: { id: data.vagaId },
      data: {
        etapaId: novaEtapa.id,
        status: "fechada",
        fechadoEm: new Date(),
        valor: data.valorVenda,
      },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: data.vagaId,
        tipo: "mudanca_etapa",
        autorId: usuario.id,
        conteudo: `Movida de "${etapaAnterior.etapa.nome}" para "${novaEtapa.nome}".`,
      },
    });

    await gerarFaturamentoEComissao(tx, {
      empresaId: vaga.empresaId,
      origemTipo: "vaga",
      origemId: vaga.id,
      valor: Number(vaga.valor),
      vertical: vaga.vertical,
      usuarioId: vaga.recrutadorId,
      dadosFechamento: {
        dataInicio: new Date(data.dataInicio),
        contatosNfIds: data.contatosNfIds,
        dataEmissaoNf: new Date(data.dataEmissaoNf),
        dataInicioProfissional: data.dataInicioProfissional ? new Date(data.dataInicioProfissional) : undefined,
        dataTerminoAlocacao: data.dataTerminoAlocacao ? new Date(data.dataTerminoAlocacao) : undefined,
      },
    });

    await dispararEntrouEtapa(tx, novaEtapa.id, {
      entidadeTipo: "vaga",
      entidadeId: vaga.id,
      responsavelId: vaga.recrutadorId,
    });
  });

  revalidateAts();
  revalidatePath(`/vagas/${data.vagaId}`);
  revalidatePath("/financeiro");
}

export async function atualizarVaga(input: AtualizarVagaFormInput) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const { vagaId, dataLimite, ...rest } = atualizarVagaSchema.parse(input);
  await assertPodeAcessarVaga(usuario.papel, vagaId);

  await prisma.vaga.update({
    where: { id: vagaId },
    data: {
      ...rest,
      dataLimite: dataLimite ? new Date(dataLimite) : dataLimite === null ? null : undefined,
    },
  });

  revalidateAts();
  revalidatePath(`/vagas/${vagaId}`);
}

/** Busca sob demanda (dialog de adicionar candidato, client-side) — mesma
 * leitura de modules/ats/queries.ts#getCandidatos, exposta como Server Action. */
export async function buscarCandidatos(busca: string) {
  await requirePapel(PAPEIS_ATS);
  if (!busca.trim()) return [];
  const candidatos = await getCandidatos({ busca });
  return candidatos.map(serializeCandidato);
}

export async function criarCandidato(input: CriarCandidatoFormInput) {
  await requirePapel(PAPEIS_ATS);
  const data = criarCandidatoSchema.parse(input);

  const candidato = await prisma.candidato.create({
    data: {
      nome: data.nome,
      cargoAtual: data.cargoAtual,
      empresaAtual: data.empresaAtual,
      cidade: data.cidade,
      estado: data.estado,
      telefone: data.telefone,
      whatsapp: data.whatsapp,
      email: data.email || undefined,
      linkedin: data.linkedin,
      github: data.github,
      portfolioUrl: data.portfolioUrl,
      skills: csvToArray(data.skills),
      tecnologias: csvToArray(data.tecnologias),
      pretensaoSalarial: data.pretensaoSalarial,
      disponibilidade: data.disponibilidade,
      observacoes: data.observacoes,
    },
  });

  revalidateAts();
  return serializeCandidato(candidato);
}

export async function adicionarCandidatoAVaga(input: {
  vagaId: string;
  candidatoId: string;
  fitScore?: number;
  fitScoreJustificativa?: string;
  fitScoreModelo?: string;
}) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = adicionarCandidatoVagaSchema.parse(input);
  await assertPodeAcessarVaga(usuario.papel, data.vagaId);

  const vagaCandidato = await prisma.$transaction(async (tx) => {
    const vc = await tx.vagaCandidato.create({
      data: {
        vagaId: data.vagaId,
        candidatoId: data.candidatoId,
        ...(data.fitScore != null
          ? {
              fitScore: data.fitScore,
              fitScoreJustificativa: data.fitScoreJustificativa,
              fitScoreModelo: data.fitScoreModelo,
              fitScoreGeradoEm: new Date(),
            }
          : {}),
      },
      include: { candidato: true },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: data.vagaId,
        tipo: "nota",
        autorId: usuario.id,
        conteudo: `Candidato "${vc.candidato.nome}" adicionado ao processo.`,
      },
    });

    return vc;
  });

  revalidateAts();
  revalidatePath(`/vagas/${data.vagaId}`);
  return serializeVagaCandidato(vagaCandidato);
}

export async function moverCandidatoNaVaga(input: {
  vagaCandidatoId: string;
  novaEtapa: string;
  motivoPerda?: string;
}) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = moverCandidatoVagaSchema.parse(input);

  if (data.novaEtapa === "perdida" && !data.motivoPerda) {
    throw new Error("Informe o motivo da perda para mover para esta etapa.");
  }

  const vagaId = await prisma.$transaction(async (tx) => {
    const atual = await tx.vagaCandidato.findUniqueOrThrow({
      where: { id: data.vagaCandidatoId },
      include: { candidato: true, vaga: true },
    });

    if (atual.vaga.confidencial && !podeVerConfidencial(usuario.papel)) {
      throw new Error("Vaga não encontrada.");
    }

    await tx.vagaCandidato.update({
      where: { id: data.vagaCandidatoId },
      data: {
        etapa: data.novaEtapa as never,
        motivoPerda: data.novaEtapa === "perdida" ? data.motivoPerda : null,
      },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: atual.vagaId,
        tipo: "mudanca_etapa",
        autorId: usuario.id,
        conteudo: `Candidato "${atual.candidato.nome}" movido de "${atual.etapa}" para "${data.novaEtapa}".${
          data.motivoPerda ? ` Motivo: ${data.motivoPerda}` : ""
        }`,
      },
    });

    // Fluxo do recrutador (fluxos-usuario.md #2, passo 6): ao fechar uma
    // posição, incrementa o contador da vaga — quem decide se fecha a vaga
    // inteira é o recrutador na tela de detalhe, não uma automação silenciosa.
    if (data.novaEtapa === "fechada" && atual.etapa !== "fechada") {
      await tx.vaga.update({
        where: { id: atual.vagaId },
        data: { posicoesPreenchidas: { increment: 1 } },
      });
    }

    return atual.vagaId;
  });

  revalidateAts();
  revalidatePath(`/vagas/${vagaId}`);
}

/** Busca sob demanda (tab de atividades da vaga, client-side) — mesma leitura
 * de modules/ats/queries.ts#getAtividadesDaVaga, exposta como Server Action. */
export async function listarAtividadesVaga(vagaId: string) {
  await requirePapel(PAPEIS_ATS);
  return prisma.atividade.findMany({
    where: { entidadeTipo: "vaga", entidadeId: vagaId },
    include: { autor: true },
    orderBy: { criadoEm: "desc" },
  });
}

export async function criarAtividadeVaga(input: { vagaId: string; conteudo: string }) {
  const usuario = await requirePapel(PAPEIS_ATS);

  const atividade = await prisma.atividade.create({
    data: {
      entidadeTipo: "vaga",
      entidadeId: input.vagaId,
      tipo: "nota",
      autorId: usuario.id,
      conteudo: input.conteudo,
    },
    include: { autor: true },
  });

  revalidateAts();
  return atividade;
}

/** Fluxo comercial (fluxos-usuario.md #1, passo 5): oportunidade Ganha oferece
 * criar a vaga correspondente já pré-preenchida — chamada a partir do drawer
 * de oportunidade do CRM, por isso exige papel de CRM (não só ATS). */
export async function criarVagaAPartirDeOportunidade(oportunidadeId: string) {
  await requirePapel(PAPEIS_CRM);

  const oportunidade = await prisma.oportunidade.findUniqueOrThrow({
    where: { id: oportunidadeId },
    include: { empresa: true },
  });

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "vagas" },
    include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
  });
  const primeiraEtapa = pipeline?.etapas[0];
  if (!primeiraEtapa) {
    throw new Error("Pipeline de Vagas sem etapas — rode prisma/seed.sql.");
  }

  const vaga = await prisma.vaga.create({
    data: {
      empresaId: oportunidade.empresaId,
      oportunidadeOrigemId: oportunidade.id,
      etapaId: primeiraEtapa.id,
      cargo: "A definir",
      vertical: oportunidade.vertical,
    },
    include: { empresa: true },
  });

  revalidateAts();
  revalidatePath("/crm/pipeline-comercial");
  return serializeVaga(vaga);
}

/** Fase 7 — recrutador aprova uma edição de perfil proposta pelo candidato
 * no Portal do Candidato: só agora os `campos` propostos são de fato
 * escritos em Candidato (nunca antes disso). */
export async function aprovarEdicaoPerfil(edicaoId: string) {
  const usuario = await requirePapel(PAPEIS_ATS);

  const edicao = await prisma.edicaoPerfilPendente.findUniqueOrThrow({ where: { id: edicaoId } });
  if (edicao.status !== "pendente") {
    throw new Error("Esta edição já foi revisada.");
  }

  const campos = edicao.campos as Record<string, unknown>;
  const { disponibilidade, pretensaoSalarial, ...resto } = campos;

  await prisma.$transaction([
    prisma.candidato.update({
      where: { id: edicao.candidatoId },
      data: {
        ...resto,
        ...(disponibilidade ? { disponibilidade: disponibilidade as never } : {}),
        ...(pretensaoSalarial != null ? { pretensaoSalarial: Number(pretensaoSalarial) } : {}),
      },
    }),
    prisma.edicaoPerfilPendente.update({
      where: { id: edicaoId },
      data: { status: "aprovada", revisadoPorId: usuario.id, revisadoEm: new Date() },
    }),
  ]);

  revalidatePath(`/candidatos/${edicao.candidatoId}`);
}

export async function rejeitarEdicaoPerfil(edicaoId: string) {
  const usuario = await requirePapel(PAPEIS_ATS);

  const edicao = await prisma.edicaoPerfilPendente.findUniqueOrThrow({ where: { id: edicaoId } });
  if (edicao.status !== "pendente") {
    throw new Error("Esta edição já foi revisada.");
  }

  await prisma.edicaoPerfilPendente.update({
    where: { id: edicaoId },
    data: { status: "rejeitada", revisadoPorId: usuario.id, revisadoEm: new Date() },
  });

  revalidatePath(`/candidatos/${edicao.candidatoId}`);
}
