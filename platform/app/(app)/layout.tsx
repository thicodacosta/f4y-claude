import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { getMinhasNotificacoes } from "@/modules/notificacoes/queries";
import { verificarNfsPendentes, verificarVencimentosAlocacao } from "@/modules/financeiro/alertas";
import type { Papel } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O middleware já redireciona não-autenticados para /login antes de chegar
  // aqui — este guard cobre só o caso de a sessão expirar entre o middleware
  // e a renderização deste layout.
  if (!user) redirect("/login");

  const usuario = await prisma.usuario.findUnique({ where: { id: user.id } });
  const nome = usuario?.nome ?? user.email?.split("@")[0] ?? "Usuário";
  const papel = (usuario?.papel as Papel | undefined) ?? null;

  // Fase 7 — portais externos vivem em route groups próprios ((portal-cliente)/
  // (portal-candidato)), com seu próprio shell (sem sidebar/nav interna).
  // Um usuário de portal que caia aqui (ex.: link antigo, sessão trocada) é
  // redirecionado de volta pro portal correto.
  if (papel === "cliente_portal") redirect("/portal-cliente/vagas");
  if (papel === "candidato_portal") redirect("/portal-candidato/processo");

  // Verificações oportunistas (sem cron real, mesmo padrão de
  // modules/alocacao/renovacao.ts) — rodam aqui, e não só no Dashboard, pra
  // o pop-up de alerta ter a melhor chance de aparecer em qualquer página.
  await Promise.all([verificarNfsPendentes(), verificarVencimentosAlocacao()]);

  const notificacoes = await getMinhasNotificacoes();

  return (
    <AppShell papel={papel} nome={nome} email={user.email ?? ""} notificacoes={notificacoes}>
      {children}
    </AppShell>
  );
}
