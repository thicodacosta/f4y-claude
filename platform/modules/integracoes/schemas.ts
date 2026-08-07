import { z } from "zod";

export const provedorIntegracaoValues = ["google", "linkedin", "whatsapp"] as const;
export type ProvedorIntegracao = (typeof provedorIntegracaoValues)[number];

export const provedorIntegracaoLabel: Record<ProvedorIntegracao, string> = {
  google: "Gmail",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

/** LinkedIn não libera API de Recruiter/contatos pra apps comuns — a
 * integração aqui é só identificação (Sign in with LinkedIn via OpenID
 * Connect), não import de rede nem envio de mensagem. */
export const provedorIntegracaoDescricao: Record<ProvedorIntegracao, string> = {
  google: "Envie e-mails pelo seu Gmail direto da plataforma — cada envio vira uma atividade registrada.",
  linkedin: "Identificação da sua conta LinkedIn (perfil básico) — a API do LinkedIn não libera import de contatos/Recruiter para apps de terceiros.",
  whatsapp: "Envie mensagens pelo seu número do WhatsApp Business — cada envio vira uma atividade registrada.",
};

export const conectarWhatsappSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Informe o Phone Number ID"),
  accessToken: z.string().trim().min(1, "Informe o access token"),
});

export type ConectarWhatsappFormInput = z.input<typeof conectarWhatsappSchema>;

export const enviarEmailCandidatoSchema = z.object({
  candidatoId: z.string().uuid(),
  assunto: z.string().trim().min(1, "Informe o assunto"),
  corpo: z.string().trim().min(1, "Informe a mensagem"),
});

export type EnviarEmailCandidatoFormInput = z.input<typeof enviarEmailCandidatoSchema>;

export const enviarWhatsappCandidatoSchema = z.object({
  candidatoId: z.string().uuid(),
  mensagem: z.string().trim().min(1, "Informe a mensagem"),
});

export type EnviarWhatsappCandidatoFormInput = z.input<typeof enviarWhatsappCandidatoSchema>;
