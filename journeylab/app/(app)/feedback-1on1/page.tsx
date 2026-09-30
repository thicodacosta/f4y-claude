import { redirect } from "next/navigation";

/**
 * Endereço alternativo do módulo (links como /feedback-1on1?action=create&employee=<id>).
 * Apenas traduz para as rotas do módulo; permissão e escopo do colaborador são
 * validados nas páginas de destino. Parâmetros extras não são repassados.
 */
export default async function FeedbackAlias({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const pessoa = sp.employee && /^[0-9a-f-]{36}$/.test(sp.employee) ? sp.employee : null;
  const q = (base: string) => (pessoa ? `${base}?colaborador=${pessoa}` : base);
  if (sp.action === "create") redirect(q("/feedback/novo"));
  if (sp.action === "schedule") redirect(q("/feedback/agendar"));
  redirect("/feedback");
}
