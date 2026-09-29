-- AlterTable
ALTER TABLE "eventos_integracao" ADD COLUMN     "aplicado_por" TEXT,
ADD COLUMN     "comprador_documento" TEXT,
ADD COLUMN     "comprador_email" TEXT,
ADD COLUMN     "organizacao_id" UUID,
ADD COLUMN     "pedido_id" TEXT,
ADD COLUMN     "produto_id_externo" TEXT,
ADD COLUMN     "tipo" TEXT;

-- CreateTable
CREATE TABLE "politicas_retencao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "crm_candidatos_meses" INTEGER,
    "crm_anexos_meses" INTEGER,
    "feedback_notas_meses" INTEGER,
    "pulse_meses" INTEGER,
    "nr1_respostas_meses" INTEGER,
    "atualizado_por" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "ultima_execucao" TIMESTAMP(3),

    CONSTRAINT "politicas_retencao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "politicas_retencao_tenant_id_key" ON "politicas_retencao"("tenant_id");

-- CreateIndex
CREATE INDEX "eventos_integracao_pedido_id_idx" ON "eventos_integracao"("pedido_id");

-- AddForeignKey
ALTER TABLE "politicas_retencao" ADD CONSTRAINT "politicas_retencao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
