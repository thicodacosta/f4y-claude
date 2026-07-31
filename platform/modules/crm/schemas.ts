import { z } from "zod";

/**
 * Schemas compartilhados entre o formulário (client) e a Server Action
 * (server) — mesma validação dos dois lados, conforme
 * docs/business-platform/arquitetura.md.
 */

export const verticalNegocioValues = [
  "tecnologia",
  "corporativo",
  "executive_search",
  "alocacao_tech",
] as const;

export const verticalNegocioLabel: Record<(typeof verticalNegocioValues)[number], string> = {
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

export const criarContatoSchema = z.object({
  empresaId: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome do contato"),
  cargo: z.string().trim().optional(),
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
