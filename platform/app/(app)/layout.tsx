import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
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

  return (
    <AppShell papel={papel} nome={nome} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
