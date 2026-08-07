-- `atualizado_em` usa @updatedAt no Prisma (só aplicado pelo Prisma Client em
-- escrita via Prisma) — o seed de regras_comissao (prisma/seed.sql) insere
-- direto via SQL fora do Prisma Client, então precisa de um DEFAULT no banco
-- para não violar NOT NULL. Mesmo fix já aplicado em usuarios na migration
-- 20260731115625_fix_atualizado_em_default.
ALTER TABLE "regras_comissao" ALTER COLUMN "atualizado_em" SET DEFAULT CURRENT_TIMESTAMP;
