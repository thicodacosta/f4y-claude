import { z } from "zod";

export const statusContratoValues = ["ativo", "renovado", "encerrado"] as const;
export const statusContratoLabel: Record<(typeof statusContratoValues)[number], string> = {
  ativo: "Ativo",
  renovado: "Renovado",
  encerrado: "Encerrado",
};

export const criarContratoSchema = z.object({
  vagaId: z.string().uuid(),
  candidatoId: z.string().uuid(),
  rate: z.coerce.number().min(0),
  prazoMeses: z.coerce.number().int().min(1),
  dataInicio: z.string().min(1, "Informe a data de início"),
});

export type CriarContratoFormInput = z.input<typeof criarContratoSchema>;

export const renovarContratoSchema = z.object({
  contratoId: z.string().uuid(),
  prazoMeses: z.coerce.number().int().min(1),
});

export const encerrarContratoSchema = z.object({
  contratoId: z.string().uuid(),
});
