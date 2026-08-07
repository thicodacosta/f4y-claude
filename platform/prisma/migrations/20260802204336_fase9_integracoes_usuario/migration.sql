-- CreateEnum
CREATE TYPE "ProvedorIntegracao" AS ENUM ('google', 'linkedin', 'whatsapp');

-- CreateTable
CREATE TABLE "integracoes_usuario" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "provedor" "ProvedorIntegracao" NOT NULL,
    "conta_externa" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expira_em" TIMESTAMP(3),
    "conectado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integracoes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integracoes_usuario_usuario_id_provedor_key" ON "integracoes_usuario"("usuario_id", "provedor");

-- AddForeignKey
ALTER TABLE "integracoes_usuario" ADD CONSTRAINT "integracoes_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
