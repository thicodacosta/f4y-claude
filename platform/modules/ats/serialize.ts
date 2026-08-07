import type {
  Vaga,
  Candidato,
  VagaCandidato,
  Empresa,
  Oportunidade,
  PipelineEtapa,
  Usuario,
} from "@/lib/generated/prisma/client";

/** Mesma razão de modules/crm/serialize.ts: Decimal/Date do Prisma viram
 * objeto não-plano do lado do client — converte para number/string aqui. */
export type VagaClient = {
  id: string;
  empresaId: string;
  empresaNome: string;
  oportunidadeOrigemId: string | null;
  etapaId: string;
  cargo: string;
  vertical: string;
  consultorId: string | null;
  consultorNome: string | null;
  recrutadorId: string | null;
  recrutadorNome: string | null;
  quantidadePosicoes: number;
  posicoesPreenchidas: number;
  dataAbertura: string | null;
  dataLimite: string | null;
  slaDias: number | null;
  valor: number | null;
  prioridade: string;
  tags: string[];
  stackTecnologica: string[];
  confidencial: boolean;
  empresasAlvo: string[];
  jobDescription: string | null;
  skillsRequeridas: string[];
  gestorNome: string | null;
  gestorContato: string | null;
  salarioMin: number | null;
  salarioMax: number | null;
  beneficios: string | null;
  modeloTrabalho: string | null;
  cidade: string | null;
  estado: string | null;
  senioridade: string | null;
  status: string;
  checklist: unknown;
  criadoEm: string;
  atualizadoEm: string;
  fechadoEm: string | null;
};

type VagaComRelacoes = Vaga & {
  empresa: Empresa;
  oportunidadeOrigem?: Oportunidade | null;
  consultor?: Usuario | null;
  recrutador?: Usuario | null;
};

export function serializeVaga(v: VagaComRelacoes): VagaClient {
  return {
    id: v.id,
    empresaId: v.empresaId,
    empresaNome: v.empresa.nome,
    oportunidadeOrigemId: v.oportunidadeOrigemId,
    etapaId: v.etapaId,
    cargo: v.cargo,
    vertical: v.vertical,
    consultorId: v.consultorId,
    consultorNome: v.consultor?.nome ?? null,
    recrutadorId: v.recrutadorId,
    recrutadorNome: v.recrutador?.nome ?? null,
    quantidadePosicoes: v.quantidadePosicoes,
    posicoesPreenchidas: v.posicoesPreenchidas,
    dataAbertura: v.dataAbertura ? v.dataAbertura.toISOString() : null,
    dataLimite: v.dataLimite ? v.dataLimite.toISOString() : null,
    slaDias: v.slaDias,
    valor: v.valor ? Number(v.valor) : null,
    prioridade: v.prioridade,
    tags: v.tags,
    stackTecnologica: v.stackTecnologica,
    confidencial: v.confidencial,
    empresasAlvo: v.empresasAlvo,
    jobDescription: v.jobDescription,
    skillsRequeridas: v.skillsRequeridas,
    gestorNome: v.gestorNome,
    gestorContato: v.gestorContato,
    salarioMin: v.salarioMin ? Number(v.salarioMin) : null,
    salarioMax: v.salarioMax ? Number(v.salarioMax) : null,
    beneficios: v.beneficios,
    modeloTrabalho: v.modeloTrabalho,
    cidade: v.cidade,
    estado: v.estado,
    senioridade: v.senioridade,
    status: v.status,
    checklist: v.checklist,
    criadoEm: v.criadoEm.toISOString(),
    atualizadoEm: v.atualizadoEm.toISOString(),
    fechadoEm: v.fechadoEm ? v.fechadoEm.toISOString() : null,
  };
}

export type CandidatoClient = {
  id: string;
  nome: string;
  fotoUrl: string | null;
  cargoAtual: string | null;
  empresaAtual: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  linkedin: string | null;
  github: string | null;
  portfolioUrl: string | null;
  curriculoUrl: string | null;
  skills: string[];
  tecnologias: string[];
  idiomas: string[];
  certificacoes: string[];
  pretensaoSalarial: number | null;
  disponibilidade: string | null;
  status: string;
  scoreIa: number | null;
  scoreIaGeradoEm: string | null;
  scoreIaModelo: string | null;
  resumoIa: string | null;
  observacoes: string | null;
  experiencias: unknown;
  formacao: unknown;
  criadoEm: string;
  atualizadoEm: string;
};

export function serializeCandidato(c: Candidato): CandidatoClient {
  return {
    id: c.id,
    nome: c.nome,
    fotoUrl: c.fotoUrl,
    cargoAtual: c.cargoAtual,
    empresaAtual: c.empresaAtual,
    cidade: c.cidade,
    estado: c.estado,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    email: c.email,
    linkedin: c.linkedin,
    github: c.github,
    portfolioUrl: c.portfolioUrl,
    curriculoUrl: c.curriculoUrl,
    skills: c.skills,
    tecnologias: c.tecnologias,
    idiomas: c.idiomas,
    certificacoes: c.certificacoes,
    pretensaoSalarial: c.pretensaoSalarial ? Number(c.pretensaoSalarial) : null,
    disponibilidade: c.disponibilidade,
    status: c.status,
    scoreIa: c.scoreIa ? Number(c.scoreIa) : null,
    scoreIaGeradoEm: c.scoreIaGeradoEm ? c.scoreIaGeradoEm.toISOString() : null,
    scoreIaModelo: c.scoreIaModelo,
    resumoIa: c.resumoIa,
    observacoes: c.observacoes,
    experiencias: c.experiencias,
    formacao: c.formacao,
    criadoEm: c.criadoEm.toISOString(),
    atualizadoEm: c.atualizadoEm.toISOString(),
  };
}

export type VagaCandidatoClient = {
  id: string;
  vagaId: string;
  candidatoId: string;
  candidato: CandidatoClient;
  etapa: string;
  fitScore: number | null;
  motivoPerda: string | null;
  criadoEm: string;
};

type VagaCandidatoComRelacoes = VagaCandidato & { candidato: Candidato };

export function serializeVagaCandidato(vc: VagaCandidatoComRelacoes): VagaCandidatoClient {
  return {
    id: vc.id,
    vagaId: vc.vagaId,
    candidatoId: vc.candidatoId,
    candidato: serializeCandidato(vc.candidato),
    etapa: vc.etapa,
    fitScore: vc.fitScore ? Number(vc.fitScore) : null,
    motivoPerda: vc.motivoPerda,
    criadoEm: vc.criadoEm.toISOString(),
  };
}

export type PipelineEtapaClient = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  isGanho: boolean;
  isPerdido: boolean;
};

export function serializeVagaEtapa(e: PipelineEtapa): PipelineEtapaClient {
  return {
    id: e.id,
    nome: e.nome,
    cor: e.cor,
    ordem: e.ordem,
    isGanho: e.isGanho,
    isPerdido: e.isPerdido,
  };
}
