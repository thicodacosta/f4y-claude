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
  contatoId: string | null;
  contatoNome: string | null;
  etapaId: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  vertical: string;
  origem: string | null;
  valorEstimado: number;
  probabilidade: number | null;
  previsaoFechamento: string | null;
  produtos: string[];
  motivoPerda: string | null;
  observacoes: string | null;
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
    contatoId: o.contatoId,
    contatoNome: o.contato?.nome ?? null,
    etapaId: o.etapaId,
    responsavelId: o.responsavelId,
    responsavelNome: o.responsavel?.nome ?? null,
    vertical: o.vertical,
    origem: o.origem,
    valorEstimado: Number(o.valorEstimado),
    probabilidade: o.probabilidade ? Number(o.probabilidade) : null,
    previsaoFechamento: o.previsaoFechamento ? o.previsaoFechamento.toISOString() : null,
    produtos: o.produtos,
    motivoPerda: o.motivoPerda,
    observacoes: o.observacoes,
    criadoEm: o.criadoEm.toISOString(),
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
