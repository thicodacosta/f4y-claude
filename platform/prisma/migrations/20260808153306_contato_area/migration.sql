-- CreateEnum
CREATE TYPE "AreaContato" AS ENUM ('rh', 'tecnologia');

-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "area" "AreaContato";
