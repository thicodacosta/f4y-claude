import { z } from "zod";

export const metaTipoValues = ["comercial", "recrutamento"] as const;
export const metaTipoLabel: Record<(typeof metaTipoValues)[number], string> = {
  comercial: "Comercial (valor ganho)",
  recrutamento: "Recrutamento (vagas fechadas)",
};

export const criarOuAtualizarMetaSchema = z.object({
  usuarioId: z.string().uuid(),
  tipo: z.enum(metaTipoValues),
  ano: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  valorAlvo: z.coerce.number().min(0),
});

export type CriarOuAtualizarMetaFormInput = z.input<typeof criarOuAtualizarMetaSchema>;

/** Goal Center (Fase 11/Intelligence) — meta da empresa inteira ou de uma
 * vertical de negócio, diferente da meta por usuário acima. */
export const categoriaMetaValues = ["todas", "alocacao", "recrutamento", "executive_search"] as const;
export const categoriaMetaLabel: Record<(typeof categoriaMetaValues)[number], string> = {
  todas: "Empresa (todas as verticais)",
  alocacao: "Alocação de Profissionais",
  recrutamento: "Recrutamento & Seleção",
  executive_search: "Executive Search",
};

export const criarOuAtualizarMetaOrganizacionalSchema = z.object({
  categoria: z.enum(categoriaMetaValues),
  ano: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  valorAlvo: z.coerce.number().min(0),
});

export type CriarOuAtualizarMetaOrganizacionalFormInput = z.input<typeof criarOuAtualizarMetaOrganizacionalSchema>;
