-- AlterTable
ALTER TABLE "oportunidades" ADD COLUMN     "executive_search" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "executive_search" BOOLEAN NOT NULL DEFAULT false;
