/*
  Warnings:

  - A unique constraint covering the columns `[candidato_id]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FeedbackCliente" AS ENUM ('aprovado', 'reprovado');

-- CreateEnum
CREATE TYPE "StatusEdicaoPerfil" AS ENUM ('pendente', 'aprovada', 'rejeitada');

-- AlterEnum
ALTER TYPE "TipoAtividade" ADD VALUE 'feedback_cliente';

-- AlterTable
ALTER TABLE "vaga_candidatos" ADD COLUMN     "comentario_cliente" TEXT,
ADD COLUMN     "feedback_cliente" "FeedbackCliente",
ADD COLUMN     "feedback_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "edicoes_perfil_pendentes" (
    "id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "campos" JSONB NOT NULL,
    "status" "StatusEdicaoPerfil" NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisado_por_id" UUID,
    "revisado_em" TIMESTAMP(3),

    CONSTRAINT "edicoes_perfil_pendentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "edicoes_perfil_pendentes_candidato_id_idx" ON "edicoes_perfil_pendentes"("candidato_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_candidato_id_key" ON "usuarios"("candidato_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edicoes_perfil_pendentes" ADD CONSTRAINT "edicoes_perfil_pendentes_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edicoes_perfil_pendentes" ADD CONSTRAINT "edicoes_perfil_pendentes_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
