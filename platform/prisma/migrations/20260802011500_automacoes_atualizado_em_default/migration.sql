-- `atualizado_em` usa @updatedAt no Prisma (só aplicado pelo Prisma Client em
-- escrita via Prisma) — o seed de automações (prisma/seed.sql) insere direto
-- via SQL fora do Prisma Client, então precisa de um DEFAULT no banco para
-- não violar NOT NULL. Mesmo fix já aplicado em usuarios e regras_comissao.
ALTER TABLE "automacoes" ALTER COLUMN "atualizado_em" SET DEFAULT CURRENT_TIMESTAMP;
