import { z } from "zod";

export const enviarFeedbackSchema = z.object({
  vagaCandidatoId: z.string().uuid(),
  feedback: z.enum(["aprovado", "reprovado"]),
  comentario: z.string().trim().max(2000).optional(),
});

export type EnviarFeedbackInput = z.input<typeof enviarFeedbackSchema>;

/** Fluxos-usuario.md #7 — status simplificado, sem nomes de etapa interna. */
export const statusSimplificadoLabel = {
  em_andamento: "Em andamento",
  shortlist_disponivel: "Shortlist disponível",
  fechada: "Fechada",
  encerrada: "Encerrada",
} as const;

export type StatusSimplificado = keyof typeof statusSimplificadoLabel;
