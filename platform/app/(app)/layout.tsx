import { redirect } from "next/navigation";
import { getSessionUsuario } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getMinhasNotificacoes } from "@/modules/notificacoes/queries";
import { verificarNfsPendentes, verificarVencimentosAlocacao } from "@/modules/financeiro/alertas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `getSessionUsuario` é cacheado por request (ver lib/auth.ts) — todo
  // requirePapel/requireUsuario chamado mais abaixo (nas queries da própria
  // página, em paralelo) reaproveita esta mesma checagem em vez de repetir o
  // round-trip pro Supabase Auth + Postgres.
  const usuario = await getSessionUsuario();

  // O middleware já redireciona não-autenticados para /login antes de chegar
  // aqui — este guard cobre só o caso de a sessão expirar entre o middleware
  // e a renderização deste layout.
  if (!usuario) redirect("/login");

  // Fase 7 — portais externos vivem em route groups próprios ((portal-cliente)/
  // (portal-candidato)), com seu próprio shell (sem sidebar/nav interna).
  // Um usuário de portal que caia aqui (ex.: link antigo, sessão trocada) é
  // redirecionado de volta pro portal correto.
  if (usuario.papel === "cliente_portal") redirect("/portal-cliente/vagas");
  if (usuario.papel === "candidato_portal") redirect("/portal-candidato/processo");

  // Verificações oportunistas (sem cron real, mesmo padrão de
  // modules/alocacao/renovacao.ts) rodam junto com as notificações — mesmo
  // Promise.all, não mais uma leva depois da outra.
  const [, , notificacoes] = await Promise.all([
    verificarNfsPendentes(),
    verificarVencimentosAlocacao(),
    getMinhasNotificacoes(),
  ]);

  return (
    <AppShell papel={usuario.papel} nome={usuario.nome || "Usuário"} email={usuario.email} notificacoes={notificacoes}>
      {children}
    </AppShell>
  );
}
