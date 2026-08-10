-- CreateEnum
CREATE TYPE "ResultadoReuniao" AS ENUM ('interesse_alto', 'interesse_medio', 'interesse_baixo', 'sem_fit', 'aguardando_decisao');

-- AlterTable
ALTER TABLE "arquivos" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "status_proposta" TEXT,
ADD COLUMN     "valor_proposta" DECIMAL(14,2),
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "oportunidades" ADD COLUMN     "concorrente" TEXT,
ADD COLUMN     "desconto" DECIMAL(5,2),
ADD COLUMN     "detalhes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "motivo_negociacao" TEXT,
ADD COLUMN     "proxima_acao" TEXT,
ADD COLUMN     "proxima_acao_data" DATE,
ADD COLUMN     "resultado_reuniao" "ResultadoReuniao",
ADD COLUMN     "valor_negociado" DECIMAL(14,2),
ADD COLUMN     "valor_proposta" DECIMAL(14,2);
