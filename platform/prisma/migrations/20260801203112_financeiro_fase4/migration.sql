-- CreateEnum
CREATE TYPE "StatusFaturamento" AS ENUM ('pendente', 'faturado', 'pago');

-- CreateEnum
CREATE TYPE "StatusComissao" AS ENUM ('pendente', 'aprovada', 'paga');

-- CreateTable
CREATE TABLE "faturamentos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "origem_tipo" "EntidadeTipo" NOT NULL,
    "origem_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "status" "StatusFaturamento" NOT NULL DEFAULT 'pendente',
    "data_prevista" DATE,
    "data_efetiva" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "origem_tipo" "EntidadeTipo" NOT NULL,
    "origem_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "status" "StatusComissao" NOT NULL DEFAULT 'pendente',
    "competencia" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_comissao" (
    "id" UUID NOT NULL,
    "vertical" "VerticalNegocio" NOT NULL,
    "percentual_consultor" DECIMAL(5,2) NOT NULL,
    "percentual_recrutador" DECIMAL(5,2) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faturamentos_origem_tipo_origem_id_idx" ON "faturamentos"("origem_tipo", "origem_id");

-- CreateIndex
CREATE INDEX "comissoes_origem_tipo_origem_id_idx" ON "comissoes"("origem_tipo", "origem_id");

-- CreateIndex
CREATE UNIQUE INDEX "regras_comissao_vertical_key" ON "regras_comissao"("vertical");

-- AddForeignKey
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
