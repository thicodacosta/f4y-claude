import { z } from "zod";
import { disponibilidadeValues } from "@/modules/ats/schemas";

/** Fluxos-usuario.md, Portal do Candidato: "edição de perfil com revisão" —
 * só este subconjunto de campos é editável pelo próprio candidato (dados de
 * contato/currículo). Campos internos (score/observações/nome/e-mail de
 * login) ficam fora, de propósito. */
export const propostaEdicaoPerfilSchema = z.object({
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  linkedin: z.string().trim().max(300).optional().or(z.literal("")),
  github: z.string().trim().max(300).optional().or(z.literal("")),
  portfolioUrl: z.string().trim().max(300).optional().or(z.literal("")),
  curriculoUrl: z.string().trim().max(300).optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  pretensaoSalarial: z.coerce.number().min(0).optional(),
  disponibilidade: z.enum(disponibilidadeValues).optional(),
  skills: z.array(z.string()).optional(),
});

export type PropostaEdicaoPerfilInput = z.input<typeof propostaEdicaoPerfilSchema>;
