import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";

/**
 * E-mail transacional por SMTP — funciona com qualquer provedor (Resend,
 * SendGrid, SES…) e, em desenvolvimento, com o Mailpit do Supabase local.
 * Variáveis: SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_SENHA, SMTP_SEGURO, EMAIL_REMETENTE.
 */
export class ErroEmail extends Error {}

export const emailValido = (v: string | null | undefined): v is string => !!v && z.string().email().safeParse(v).success;

export async function enviarEmail(m: { para: string; assunto: string; texto: string; html: string }) {
  const host = process.env.SMTP_HOST;
  const remetente = process.env.EMAIL_REMETENTE;
  if (!host || !remetente) throw new ErroEmail("Envio de e-mail não configurado neste ambiente (SMTP_HOST e EMAIL_REMETENTE).");
  if (!emailValido(m.para)) throw new ErroEmail("Endereço de e-mail do destinatário inválido.");
  const transporte = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SEGURO === "true",
    auth: process.env.SMTP_USUARIO ? { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_SENHA } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  try {
    await transporte.sendMail({ from: remetente, to: m.para, subject: m.assunto, text: m.texto, html: m.html });
  } catch (e) {
    throw new ErroEmail(`Falha ao enviar o e-mail: ${e instanceof Error ? e.message : "erro do provedor"}.`);
  }
}

/** Escapa texto dinâmico para o corpo HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
