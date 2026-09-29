import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";

/**
 * Acesso ao banco com isolamento por organização.
 *
 * A conexão usa o papel `journeylab_app` (sem bypass de RLS). Cada operação
 * roda numa transação que primeiro define `app.tenant_id`, `app.usuario_id`
 * e `app.escopo` — as policies de prisma/rls.sql fazem o resto. Mesmo que um
 * trecho de código esqueça o filtro por tenant, o banco não devolve nem
 * aceita linhas de outra organização.
 *
 * Nunca exporte o cliente base para o resto da aplicação.
 */
const global_ = globalThis as unknown as { prismaBase?: PrismaClient };
// Cada operação usa uma transação curta (isolamento por tenant); o pool
// precisa comportar consultas paralelas de várias requisições.
const base =
  global_.prismaBase ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 20),
      connectionTimeoutMillis: 10_000,
    }),
    // Vale para as transações curtas de cada operação: sob carga (ou com o
    // servidor de desenvolvimento compilando), 5 s padrão abortavam leituras.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });
if (process.env.NODE_ENV !== "production") global_.prismaBase = base;

export type EscopoDb =
  | { escopo: "tenant"; tenantId: string; usuarioId: string }
  | { escopo: "usuario"; usuarioId: string }
  | { escopo: "plataforma"; usuarioId: string };

function configSql(e: EscopoDb) {
  const tenant = e.escopo === "tenant" ? e.tenantId : "";
  return base.$executeRaw`select set_config('app.tenant_id', ${tenant}, true),
                                 set_config('app.usuario_id', ${e.usuarioId}, true),
                                 set_config('app.escopo', ${e.escopo}, true)`;
}

function clienteCom(e: EscopoDb) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, resultado] = await base.$transaction([configSql(e), query(args)]);
          return resultado;
        },
      },
    },
  });
}

export type DbCliente = ReturnType<typeof clienteCom>;
export type Tx = Prisma.TransactionClient;

/** Dados da organização ativa (uso normal da aplicação). */
export function dbTenant(tenantId: string, usuarioId: string) {
  return clienteCom({ escopo: "tenant", tenantId, usuarioId });
}

/** Só o que pertence ao usuário (sessão, lista de organizações, consentimentos). */
export function dbUsuario(usuarioId: string) {
  return clienteCom({ escopo: "usuario", usuarioId });
}

/** Área do superadmin JourneyLab. Nunca lê respostas confidenciais (sem GRANT). */
export function dbPlataforma(usuarioId: string) {
  return clienteCom({ escopo: "plataforma", usuarioId });
}

/** Transação com vários passos sob o mesmo escopo (ex.: converter candidato + criar onboarding). */
export async function transacao<T>(e: EscopoDb, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return base.$transaction(
    async (tx) => {
      const tenant = e.escopo === "tenant" ? e.tenantId : "";
      await tx.$executeRaw`select set_config('app.tenant_id', ${tenant}, true),
                                  set_config('app.usuario_id', ${e.usuarioId}, true),
                                  set_config('app.escopo', ${e.escopo}, true)`;
      return fn(tx);
    },
    // Uploads e conversões fazem várias etapas; folga para não abortar no meio.
    { maxWait: 10_000, timeout: 30_000 },
  );
}
