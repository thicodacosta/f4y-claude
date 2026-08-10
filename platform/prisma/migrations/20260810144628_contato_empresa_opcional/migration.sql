-- DropForeignKey
ALTER TABLE "contatos" DROP CONSTRAINT "contatos_empresa_id_fkey";

-- AlterTable
ALTER TABLE "contatos" ALTER COLUMN "empresa_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
