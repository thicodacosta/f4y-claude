-- AlterEnum
ALTER TYPE "EntidadeTipo" ADD VALUE 'faturamento';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventoAutomacao" ADD VALUE 'nf_pendente';
ALTER TYPE "EventoAutomacao" ADD VALUE 'vencimento_alocacao';

-- AlterTable
ALTER TABLE "faturamentos" ADD COLUMN     "alocacao_encerrada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contatos_nf_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "data_emissao_nf" DATE,
ADD COLUMN     "data_inicio" DATE,
ADD COLUMN     "data_inicio_profissional" DATE,
ADD COLUMN     "data_termino_alocacao" DATE,
ADD COLUMN     "nf_emitida" BOOLEAN NOT NULL DEFAULT false;
