import { z } from "zod";

export const atualizarEmpresasAlvoSchema = z.object({
  vagaId: z.string().uuid(),
  empresasAlvo: z.array(z.string()),
});

export const criarAbordagemSchema = z.object({
  candidatoId: z.string().uuid(),
  conteudo: z.string().trim().min(1, "Escreva algo sobre a abordagem"),
});
