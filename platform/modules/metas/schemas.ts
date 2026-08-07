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
