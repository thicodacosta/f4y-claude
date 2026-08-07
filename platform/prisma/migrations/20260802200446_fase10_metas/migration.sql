-- CreateEnum
CREATE TYPE "MetaTipo" AS ENUM ('comercial', 'recrutamento');

-- CreateTable
CREATE TABLE "metas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "MetaTipo" NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor_alvo" DECIMAL(14,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metas_usuario_id_tipo_ano_mes_key" ON "metas"("usuario_id", "tipo", "ano", "mes");

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "metas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
