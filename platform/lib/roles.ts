import type { Papel } from "@/lib/nav";

/**
 * Grupos de papel reutilizados pelas Server Actions para autorização na
 * camada de aplicação. Espelham exatamente os grupos definidos em
 * `prisma/rls.sql` (`is_papel_crm`, `is_papel_interno`) — mantenha os dois
 * em sincronia se um mudar.
 *
 * Por quê a autorização vive aqui e não só em RLS: as Server Actions usam
 * Prisma com a connection string do Postgres diretamente (não passam pelo
 * PostgREST/Realtime do Supabase), então `auth.uid()`/RLS não têm o JWT do
 * usuário para avaliar — RLS nesta plataforma é a rede de segurança para
 * acesso direto via cliente Supabase (Realtime, por exemplo), não a
 * barreira primária das Server Actions. Ver docs/business-platform/
 * arquitetura.md, seção "Camadas dentro do monólito".
 */
export const PAPEIS_CRM: Papel[] = ["admin", "diretoria", "consultor_comercial"];

export const PAPEIS_INTERNOS: Papel[] = [
  "admin",
  "diretoria",
  "consultor_comercial",
  "recrutador",
  "consultor_executive_search",
  "financeiro",
];

export const PAPEIS_ADMIN: Papel[] = ["admin"];
