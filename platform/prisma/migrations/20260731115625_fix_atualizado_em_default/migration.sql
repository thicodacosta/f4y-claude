-- `atualizado_em` usa @updatedAt no Prisma, que só é aplicado pelo Prisma
-- Client em escrita via Prisma — não vira DEFAULT no banco por si só. A
-- trigger `handle_new_auth_user` (prisma/rls.sql) insere em `usuarios`
-- direto via SQL (fora do Prisma Client), então precisa de um DEFAULT no
-- banco para não violar NOT NULL. Isso também elimina o drift que forçava
-- `prisma migrate reset` toda vez que essa correção era aplicada só via
-- docker exec, fora do histórico de migrations.
ALTER TABLE "usuarios" ALTER COLUMN "atualizado_em" SET DEFAULT CURRENT_TIMESTAMP;
