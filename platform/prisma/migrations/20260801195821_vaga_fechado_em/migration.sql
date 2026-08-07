-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "fechado_em" TIMESTAMP(3);
