import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a chave `service_role` — ignora RLS e pode chamar a
 * Admin API (`auth.admin.*`). Só para operações administrativas do servidor
 * (Fase 7: convite de cliente/candidato para o portal via
 * `inviteUserByEmail`). Nunca importar este módulo de um Client Component
 * nem expor `SUPABASE_SERVICE_ROLE_KEY` como `NEXT_PUBLIC_*`.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
