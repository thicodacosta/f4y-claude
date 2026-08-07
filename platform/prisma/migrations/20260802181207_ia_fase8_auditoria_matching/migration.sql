-- AlterTable
ALTER TABLE "vaga_candidatos" ADD COLUMN     "fit_score_gerado_em" TIMESTAMP(3),
ADD COLUMN     "fit_score_justificativa" TEXT,
ADD COLUMN     "fit_score_modelo" TEXT;
