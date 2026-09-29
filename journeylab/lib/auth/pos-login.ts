import "server-only";

import type { User } from "@supabase/supabase-js";
import { dbUsuario } from "@/lib/db";

/** Após login/confirmação: garante o perfil do usuário na plataforma. */
export async function aposAutenticar(user: User | null) {
  if (!user?.email || !user.email_confirmed_at) return;
  const email = user.email.toLowerCase();
  await dbUsuario(user.id).usuario.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email,
      nome: (user.user_metadata?.nome as string | undefined)?.trim() || email.split("@")[0],
    },
  });
}
