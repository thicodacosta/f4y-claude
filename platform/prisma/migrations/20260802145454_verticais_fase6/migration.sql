-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('ativo', 'renovado', 'encerrado');

-- AlterEnum
ALTER TYPE "EventoAutomacao" ADD VALUE 'renovacao_contrato';

-- AlterTable
ALTER TABLE "automacoes" ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "empresas_alvo" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "contratos_alocacao" (
    "id" UUID NOT NULL,
    "vaga_id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "prazo_meses" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "status" "StatusContrato" NOT NULL DEFAULT 'ativo',
    "renovacao_lembrete_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_alocacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contratos_alocacao" ADD CONSTRAINT "contratos_alocacao_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_alocacao" ADD CONSTRAINT "contratos_alocacao_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
