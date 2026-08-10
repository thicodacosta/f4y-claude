import { z } from "zod";

/**
 * Schemas compartilhados entre o formulário (client) e a Server Action
 * (server) — mesma validação dos dois lados, conforme
 * docs/business-platform/arquitetura.md.
 */

/** Valores selecionáveis nos formulários — "executive_search" saiu daqui:
 * agora é a flag independente `executiveSearch` (checkbox ao lado de
 * Confidencial), não mais um valor de Vertical. O enum do Prisma continua
 * com 4 valores (nunca removemos valor de enum já usado), mas nenhum
 * formulário oferece "executive_search" para vaga/oportunidade nova. */
export const verticalNegocioValues = ["tecnologia", "corporativo", "alocacao_tech"] as const;

/** Categoria — dimensão nova e independente da Vertical: Alocação (sempre
 * vertical=alocacao_tech por baixo) vs. Recrutamento & Seleção (aí sim pede
 * Tecnologia ou Corporativo). Ver nova-vaga-dialog.tsx/nova-oportunidade-dialog.tsx. */
export const categoriaVagaValues = ["alocacao", "recrutamento"] as const;
export const categoriaVagaLabel: Record<(typeof categoriaVagaValues)[number], string> = {
  alocacao: "Alocação",
  recrutamento: "Recrutamento & Seleção",
};

/** Label inclui "executive_search" mesmo fora de verticalNegocioValues —
 * precisa continuar exibindo corretamente qualquer registro histórico que
 * ainda tenha esse valor (a exibição não filtra por verticalNegocioValues). */
export const verticalNegocioLabel: Record<string, string> = {
  tecnologia: "Tecnologia",
  corporativo: "Corporativo",
  executive_search: "Executive Search",
  alocacao_tech: "Alocação Tech",
};

export const criarOportunidadeSchema = z.object({
  empresaId: z.string().uuid().optional(),
  empresaNovaNome: z.string().trim().min(1).optional(),
  contatoId: z.string().uuid().optional(),
  vertical: z.enum(verticalNegocioValues),
  executiveSearch: z.boolean().optional().default(false),
  origem: z.string().trim().optional(),
  valorEstimado: z.coerce.number().min(0).default(0),
  previsaoFechamento: z.string().optional(),
  observacoes: z.string().trim().optional(),
}).refine((data) => data.empresaId || data.empresaNovaNome, {
  message: "Selecione uma empresa existente ou informe o nome de uma nova.",
  path: ["empresaNovaNome"],
});

/** Tipo de saída (após coerção) — usado pela Server Action. */
export type CriarOportunidadeInput = z.infer<typeof criarOportunidadeSchema>;
/** Tipo de entrada (antes da coerção) — usado por `useForm` no client, já que
 * `valorEstimado` aceita string do input HTML antes do zodResolver coagir. */
export type CriarOportunidadeFormInput = z.input<typeof criarOportunidadeSchema>;

export const areaContatoValues = ["rh", "tecnologia"] as const;
export const areaContatoLabel: Record<(typeof areaContatoValues)[number], string> = {
  rh: "RH",
  tecnologia: "Tecnologia",
};

export const tipoContatoValues = ["decisor", "influenciador", "usuario_final"] as const;
export const tipoContatoLabel: Record<(typeof tipoContatoValues)[number], string> = {
  decisor: "Decisor",
  influenciador: "Influenciador",
  usuario_final: "Usuário final",
};

export const nivelContatoValues = ["c_level", "diretor", "gestao", "senior", "especialista"] as const;
export const nivelContatoLabel: Record<(typeof nivelContatoValues)[number], string> = {
  c_level: "C-Level",
  diretor: "Diretor",
  gestao: "Gestão",
  senior: "Sênior",
  especialista: "Especialista",
};

export const criarContatoSchema = z.object({
  empresaId: z.string().uuid().optional(),
  nome: z.string().trim().min(1, "Informe o nome do contato"),
  cargo: z.string().trim().optional(),
  area: z.enum(areaContatoValues).optional(),
  tipo: z.enum(tipoContatoValues).optional(),
  nivel: z.enum(nivelContatoValues).optional(),
  cidade: z.string().trim().optional(),
  estado: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  linkedin: z.string().trim().optional(),
});

export type CriarContatoInput = z.infer<typeof criarContatoSchema>;

export const criarAtividadeSchema = z.object({
  entidadeTipo: z.enum(["oportunidade", "vaga", "candidato", "empresa"]),
  entidadeId: z.string().uuid(),
  tipo: z.enum(["nota", "email", "whatsapp", "ligacao", "reuniao", "tarefa", "mudanca_etapa", "automacao"]),
  conteudo: z.string().trim().min(1, "Escreva algo antes de salvar"),
});

export type CriarAtividadeInput = z.infer<typeof criarAtividadeSchema>;

export const moverOportunidadeSchema = z.object({
  oportunidadeId: z.string().uuid(),
  novaEtapaId: z.string().uuid(),
  motivoPerda: z.string().trim().optional(),
});

export const criarEtapaSchema = z.object({
  pipelineId: z.string().uuid(),
  nome: z.string().trim().min(1),
  cor: z.string().trim().min(1),
  slaDias: z.coerce.number().int().min(0).optional(),
  probabilidadePadrao: z.coerce.number().min(0).max(100).optional(),
});

export const atualizarEtapaSchema = z.object({
  etapaId: z.string().uuid(),
  nome: z.string().trim().min(1).optional(),
  cor: z.string().trim().min(1).optional(),
  slaDias: z.coerce.number().int().min(0).nullable().optional(),
  probabilidadePadrao: z.coerce.number().min(0).max(100).nullable().optional(),
});

export const reordenarEtapasSchema = z.object({
  pipelineId: z.string().uuid(),
  ordem: z.array(z.string().uuid()),
});

// --- Fase 13 — reestruturação do Pipeline Comercial ------------------------

export const resultadoReuniaoValues = [
  "interesse_alto",
  "interesse_medio",
  "interesse_baixo",
  "sem_fit",
  "aguardando_decisao",
] as const;
export const resultadoReuniaoLabel: Record<(typeof resultadoReuniaoValues)[number], string> = {
  interesse_alto: "Interesse alto",
  interesse_medio: "Interesse médio",
  interesse_baixo: "Interesse baixo",
  sem_fit: "Sem fit",
  aguardando_decisao: "Aguardando decisão",
};

/** Vocabulário sugerido — o campo continua String livre no banco (motivoPerda
 * já era assim), então "Outro" aceita qualquer texto digitado à parte. */
export const motivoPerdaPresetValues = [
  "Preço",
  "Concorrência",
  "Sem orçamento",
  "Sem fit",
  "Timing",
  "Cliente desistiu",
  "Projeto cancelado",
  "Contratou concorrente",
  "Não conseguimos contato",
  "Outro",
] as const;

export const motivoNegociacaoPresetValues = [
  "Preço",
  "Prazo",
  "Escopo",
  "Condições de pagamento",
  "Concorrência",
  "Aprovação interna",
  "Jurídico",
  "Procurement",
  "Outro",
] as const;

export const documentoCategoriaValues = ["proposta", "contrato", "outro"] as const;
export const documentoCategoriaLabel: Record<(typeof documentoCategoriaValues)[number], string> = {
  proposta: "Proposta comercial",
  contrato: "Contrato",
  outro: "Outro documento",
};

/** Edição dos campos ricos por etapa — tudo opcional, cada aba do drawer
 * manda só o que mudou (mesmo padrão de atualizarVagaSchema em
 * modules/ats/schemas.ts). `detalhes` é json solto (ver comentário no
 * schema.prisma) — validado como objeto genérico, não uma forma fixa. */
export const atualizarOportunidadeSchema = z.object({
  oportunidadeId: z.string().uuid(),
  contatoId: z.string().uuid().nullable().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  valorEstimado: z.coerce.number().min(0).optional(),
  probabilidade: z.coerce.number().min(0).max(100).nullable().optional(),
  previsaoFechamento: z.string().nullable().optional(),
  origem: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  resultadoReuniao: z.enum(resultadoReuniaoValues).nullable().optional(),
  valorProposta: z.coerce.number().min(0).nullable().optional(),
  valorNegociado: z.coerce.number().min(0).nullable().optional(),
  desconto: z.coerce.number().min(0).max(100).nullable().optional(),
  motivoNegociacao: z.string().trim().nullable().optional(),
  concorrente: z.string().trim().nullable().optional(),
  proximaAcao: z.string().trim().nullable().optional(),
  proximaAcaoData: z.string().nullable().optional(),
  detalhes: z.record(z.string(), z.unknown()).optional(),
});

export type AtualizarOportunidadeInput = z.infer<typeof atualizarOportunidadeSchema>;
export type AtualizarOportunidadeFormInput = z.input<typeof atualizarOportunidadeSchema>;
