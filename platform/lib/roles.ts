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

/** Espelha `is_papel_ats()` em prisma/rls.sql — Fase 2. */
export const PAPEIS_ATS: Papel[] = ["admin", "diretoria", "recrutador", "consultor_executive_search"];

/** Subconjunto de PAPEIS_ATS sem `recrutador` — quem pode ver vagas
 * `confidencial = true` por inteiro (nome do cliente, detalhes). Ver
 * modelagem-dados.md, seção RLS, e fluxos-usuario.md #3, passo 1. */
export const PAPEIS_EXECUTIVE_SEARCH: Papel[] = ["admin", "diretoria", "consultor_executive_search"];

/** Espelha `is_papel_financeiro()` em prisma/rls.sql — Fase 4. */
export const PAPEIS_FINANCEIRO: Papel[] = ["admin", "financeiro"];

/** Espelha `automacoes_select`/`automacao_execucoes_select` em prisma/rls.sql — Fase 5. */
export const PAPEIS_AUTOMACOES: Papel[] = ["admin", "diretoria"];

/** Fase 10 — quem vê visão agregada de outras pessoas (leaderboard de
 * metas, painel de produtividade): gestão, não cada indivíduo. Espelha
 * `metas_admin` em prisma/rls.sql. */
export const PAPEIS_GESTAO: Papel[] = ["admin", "diretoria"];
