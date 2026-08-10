-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('decisor', 'influenciador', 'usuario_final');

-- CreateEnum
CREATE TYPE "NivelContato" AS ENUM ('c_level', 'diretor', 'gestao', 'senior', 'especialista');

-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "nivel" "NivelContato",
ADD COLUMN     "tipo" "TipoContato";
