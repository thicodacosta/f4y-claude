-- CreateEnum
CREATE TYPE "CategoriaMeta" AS ENUM ('todas', 'alocacao', 'recrutamento', 'executive_search');

-- CreateTable
CREATE TABLE "metas_organizacionais" (
    "id" UUID NOT NULL,
    "categoria" "CategoriaMeta" NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor_alvo" DECIMAL(14,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_organizacionais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metas_organizacionais_categoria_ano_mes_key" ON "metas_organizacionais"("categoria", "ano", "mes");
