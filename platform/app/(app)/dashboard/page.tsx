import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL, type Papel } from "@/lib/nav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const usuario = user ? await prisma.usuario.findUnique({ where: { id: user.id } }) : null;
  const nome = usuario?.nome ?? user?.email?.split("@")[0] ?? "";
  const papel = usuario?.papel as Papel | undefined;

  return (
    <div className="flex flex-1 flex-col gap-2 px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-bold">Bem-vindo(a){nome ? `, ${nome}` : ""}.</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        {papel
          ? `Você está autenticado como ${ROLE_LABEL[papel]}.`
          : "Sua conta ainda não tem um papel atribuído em usuarios — fale com um administrador."}{" "}
        Este é o shell da Fase 0: autenticação, papéis e navegação. Os KPIs e
        gráficos completos deste Dashboard chegam na Fase 3 do roadmap.
      </p>
    </div>
  );
}
