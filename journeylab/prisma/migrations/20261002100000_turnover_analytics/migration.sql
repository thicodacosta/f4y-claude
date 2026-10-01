-- Menu por jornada: Pipeline de Vagas (etapa, prioridade, prazo e posições da vaga),
-- Offboarding (desligamentos + entrevista), Retenção (ações) e People Analytics (referências).
-- CreateEnum
CREATE TYPE "EtapaPipelineVaga" AS ENUM ('planejamento', 'divulgacao', 'triagem', 'entrevistas', 'proposta', 'concluida');
-- CreateEnum
CREATE TYPE "TipoDesligamento" AS ENUM ('pedido_demissao', 'dispensa_sem_justa_causa', 'dispensa_justa_causa', 'acordo', 'termino_contrato', 'aposentadoria', 'outro');
-- CreateEnum
CREATE TYPE "StatusAcaoRetencao" AS ENUM ('planejada', 'em_andamento', 'concluida', 'cancelada');
-- AlterEnum
ALTER TYPE "AreaPermissao" ADD VALUE 'offboarding';
ALTER TYPE "AreaPermissao" ADD VALUE 'retencao';
ALTER TYPE "AreaPermissao" ADD VALUE 'analytics';
-- AlterEnum
ALTER TYPE "Modulo" ADD VALUE 'offboarding';
ALTER TYPE "Modulo" ADD VALUE 'retencao';
ALTER TYPE "Modulo" ADD VALUE 'analytics';
-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "etapa_pipeline" "EtapaPipelineVaga" NOT NULL DEFAULT 'planejamento',
ADD COLUMN     "posicoes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "prazo_fechamento" DATE,
ADD COLUMN     "prioridade" TEXT NOT NULL DEFAULT 'media';
-- CreateTable
CREATE TABLE "desligamentos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoDesligamento" NOT NULL,
    "voluntario" BOOLEAN NOT NULL,
    "motivo_declarado" TEXT NOT NULL,
    "observacao" TEXT,
    "perda_lamentada" BOOLEAN NOT NULL DEFAULT false,
    "elegivel_recontratacao" BOOLEAN,
    "cargo" TEXT,
    "equipe_id" UUID,
    "equipe_nome" TEXT,
    "area_id" UUID,
    "area_nome" TEXT,
    "gestor_id" UUID,
    "gestor_nome" TEXT,
    "admissao" DATE,
    "entrevista_status" TEXT NOT NULL DEFAULT 'pendente',
    "entrevista_modo" TEXT,
    "email_contato" TEXT,
    "entrevista_enviada_em" TIMESTAMP(3),
    "entrevista_expira_em" TIMESTAMP(3),
    "entrevista_respondida_em" TIMESTAMP(3),
    "entrevista_erro" TEXT,
    "respostas" JSONB,
    "motivos_reais" TEXT[],
    "motivo_principal_real" TEXT,
    "enps" SMALLINT,
    "voltaria" TEXT,
    "evitavel" TEXT,
    "registrado_por" TEXT NOT NULL,
    "registrado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "desligamentos_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "acoes_retencao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT NOT NULL,
    "alcance" TEXT NOT NULL,
    "colaborador_id" UUID,
    "equipe_id" UUID,
    "responsavel_id" UUID,
    "prazo" DATE,
    "status" "StatusAcaoRetencao" NOT NULL DEFAULT 'planejada',
    "resultado" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "concluida_em" TIMESTAMP(3),
    "criado_por" TEXT NOT NULL,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acoes_retencao_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "configuracoes_analytics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "referencias" JSONB NOT NULL DEFAULT '{}',
    "atualizado_por" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "configuracoes_analytics_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "desligamentos_tenant_id_data_idx" ON "desligamentos"("tenant_id", "data");
-- CreateIndex
CREATE INDEX "desligamentos_tenant_id_colaborador_id_idx" ON "desligamentos"("tenant_id", "colaborador_id");
-- CreateIndex
CREATE INDEX "acoes_retencao_tenant_id_status_idx" ON "acoes_retencao"("tenant_id", "status");
-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_analytics_tenant_id_key" ON "configuracoes_analytics"("tenant_id");
-- AddForeignKey
ALTER TABLE "desligamentos" ADD CONSTRAINT "desligamentos_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "acoes_retencao" ADD CONSTRAINT "acoes_retencao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "acoes_retencao" ADD CONSTRAINT "acoes_retencao_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "acoes_retencao" ADD CONSTRAINT "acoes_retencao_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vagas existentes: etapa coerente com a situação atual.
UPDATE "vagas" SET "etapa_pipeline" = CASE
  WHEN "status" IN ('fechada', 'cancelada') THEN 'concluida'::"EtapaPipelineVaga"
  WHEN EXISTS (SELECT 1 FROM "candidaturas" c WHERE c."vaga_id" = "vagas"."id" AND c."status" = 'aprovado') THEN 'proposta'::"EtapaPipelineVaga"
  WHEN EXISTS (SELECT 1 FROM "candidaturas" c WHERE c."vaga_id" = "vagas"."id" AND c."status" = 'entrevista') THEN 'entrevistas'::"EtapaPipelineVaga"
  WHEN EXISTS (SELECT 1 FROM "candidaturas" c WHERE c."vaga_id" = "vagas"."id") THEN 'triagem'::"EtapaPipelineVaga"
  WHEN "publicada" THEN 'divulgacao'::"EtapaPipelineVaga"
  ELSE 'planejamento'::"EtapaPipelineVaga"
END;

ALTER TABLE "vagas" ADD CONSTRAINT "vagas_prioridade_check" CHECK ("prioridade" IN ('baixa', 'media', 'alta', 'urgente'));
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_posicoes_check" CHECK ("posicoes" BETWEEN 1 AND 999);
ALTER TABLE "desligamentos" ADD CONSTRAINT "desligamentos_entrevista_status_check" CHECK ("entrevista_status" IN ('pendente', 'enviada', 'respondida', 'dispensada'));
ALTER TABLE "desligamentos" ADD CONSTRAINT "desligamentos_enps_check" CHECK ("enps" IS NULL OR "enps" BETWEEN 0 AND 10);
ALTER TABLE "acoes_retencao" ADD CONSTRAINT "acoes_retencao_alcance_check" CHECK ("alcance" IN ('individual', 'equipe', 'organizacao'));
CREATE INDEX "vagas_tenant_id_etapa_pipeline_idx" ON "vagas"("tenant_id", "etapa_pipeline");
