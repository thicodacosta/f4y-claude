import type { Oportunidade, Empresa, Contato, Usuario, PipelineEtapa } from "@/lib/generated/prisma/client";

/**
 * Server Components podem passar `Decimal`/`Date` do Prisma como prop para
 * um Client Component (Next.js serializa via RSC), mas o valor vira um
 * objeto não-plano do lado do client — mais seguro converter para
 * number/string aqui, no limite entre camada de dados e UI.
 */
export type OportunidadeClient = {
  id: string;
  empresaId: string;
  empresaNome: string;
  empresaLogoUrl: string | null;
  empresaSegmento: string | null;
  empresaPorte: string | null;
  empresaCidade: string | null;
  empresaEstado: string | null;
  empresaStatus: string;
  contatoId: string | null;
  contatoNome: string | null;
  contatoCargo: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  contatoLinkedin: string | null;
  etapaId: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  vertical: string;
  executiveSearch: boolean;
  origem: string | null;
  valorEstimado: number;
  probabilidade: number | null;
  previsaoFechamento: string | null;
  produtos: string[];
  motivoPerda: string | null;
  observacoes: string | null;
  // Fase 13 — campos ricos do Pipeline Comercial (ver comentário no schema).
  resultadoReuniao: string | null;
  valorProposta: number | null;
  valorNegociado: number | null;
  desconto: number | null;
  motivoNegociacao: string | null;
  concorrente: string | null;
  proximaAcao: string | null;
  proximaAcaoData: string | null;
  detalhes: Record<string, unknown>;
  atualizadoEm: string;
  fechadoEm: string | null;
  criadoEm: string;
};

type OportunidadeComRelacoes = Oportunidade & {
  empresa: Empresa;
  contato: Contato | null;
  responsavel: Usuario | null;
  etapa: PipelineEtapa;
};

export function serializeOportunidade(o: OportunidadeComRelacoes): OportunidadeClient {
  return {
    id: o.id,
    empresaId: o.empresaId,
    empresaNome: o.empresa.nome,
    empresaLogoUrl: o.empresa.logoUrl,
    empresaSegmento: o.empresa.segmento,
    empresaPorte: o.empresa.porte,
    empresaCidade: o.empresa.cidade,
    empresaEstado: o.empresa.estado,
    empresaStatus: o.empresa.status,
    contatoId: o.contatoId,
    contatoNome: o.contato?.nome ?? null,
    contatoCargo: o.contato?.cargo ?? null,
    contatoEmail: o.contato?.email ?? null,
    contatoTelefone: o.contato?.telefone ?? null,
    contatoLinkedin: o.contato?.linkedin ?? null,
    etapaId: o.etapaId,
    responsavelId: o.responsavelId,
    responsavelNome: o.responsavel?.nome ?? null,
    vertical: o.vertical,
    executiveSearch: o.executiveSearch,
    origem: o.origem,
    valorEstimado: Number(o.valorEstimado),
    probabilidade: o.probabilidade ? Number(o.probabilidade) : null,
    previsaoFechamento: o.previsaoFechamento ? o.previsaoFechamento.toISOString() : null,
    produtos: o.produtos,
    motivoPerda: o.motivoPerda,
    observacoes: o.observacoes,
    resultadoReuniao: o.resultadoReuniao,
    valorProposta: o.valorProposta ? Number(o.valorProposta) : null,
    valorNegociado: o.valorNegociado ? Number(o.valorNegociado) : null,
    desconto: o.desconto ? Number(o.desconto) : null,
    motivoNegociacao: o.motivoNegociacao,
    concorrente: o.concorrente,
    proximaAcao: o.proximaAcao,
    proximaAcaoData: o.proximaAcaoData ? o.proximaAcaoData.toISOString() : null,
    detalhes: (o.detalhes as Record<string, unknown>) ?? {},
    atualizadoEm: o.atualizadoEm.toISOString(),
    fechadoEm: o.fechadoEm ? o.fechadoEm.toISOString() : null,
    criadoEm: o.criadoEm.toISOString(),
  };
}

export type ContatoClient = {
  id: string;
  nome: string;
  cargo: string | null;
  area: string | null;
  tipo: string | null;
  nivel: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  email: string | null;
  linkedin: string | null;
  empresaId: string | null;
  empresaNome: string | null;
};

type ContatoComEmpresa = Contato & { empresa: Empresa | null };

export function serializeContato(c: ContatoComEmpresa): ContatoClient {
  return {
    id: c.id,
    nome: c.nome,
    cargo: c.cargo,
    area: c.area,
    tipo: c.tipo,
    nivel: c.nivel,
    cidade: c.cidade,
    estado: c.estado,
    telefone: c.telefone,
    email: c.email,
    linkedin: c.linkedin,
    empresaId: c.empresaId,
    empresaNome: c.empresa?.nome ?? null,
  };
}

export type PipelineEtapaClient = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  slaDias: number | null;
  probabilidadePadrao: number | null;
  isGanho: boolean;
  isPerdido: boolean;
};

export function serializeEtapa(e: PipelineEtapa): PipelineEtapaClient {
  return {
    id: e.id,
    nome: e.nome,
    cor: e.cor,
    ordem: e.ordem,
    slaDias: e.slaDias,
    probabilidadePadrao: e.probabilidadePadrao ? Number(e.probabilidadePadrao) : null,
    isGanho: e.isGanho,
    isPerdido: e.isPerdido,
  };
}
