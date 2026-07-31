-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('admin', 'diretoria', 'consultor_comercial', 'recrutador', 'consultor_executive_search', 'financeiro', 'cliente_portal', 'candidato_portal');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "Papel",
    "avatar_url" TEXT,
    "empresa_id" UUID,
    "candidato_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);
