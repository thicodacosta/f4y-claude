-- CreateEnum
CREATE TYPE "TipoTarefa" AS ENUM ('tarefa', 'documento', 'material');

-- CreateEnum
CREATE TYPE "ResponsavelTarefa" AS ENUM ('rh', 'gestor', 'colaborador');

-- CreateEnum
CREATE TYPE "StatusOnboarding" AS ENUM ('em_andamento', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('pendente', 'concluida', 'dispensada');

-- CreateTable
CREATE TABLE "modelos_onboarding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "boas_vindas" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_modelo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "modelo_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "etapas_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas_modelo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "etapa_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoTarefa" NOT NULL DEFAULT 'tarefa',
    "responsavel" "ResponsavelTarefa" NOT NULL,
    "prazo_dias" INTEGER NOT NULL DEFAULT 0,
    "material_url" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tarefas_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboardings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "modelo_id" UUID,
    "modelo_nome" TEXT NOT NULL,
    "boas_vindas" TEXT,
    "inicio" DATE NOT NULL,
    "status" "StatusOnboarding" NOT NULL DEFAULT 'em_andamento',
    "concluido_em" TIMESTAMP(3),
    "concluido_por" TEXT,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas_onboarding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "onboarding_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoTarefa" NOT NULL,
    "responsavel_tipo" "ResponsavelTarefa" NOT NULL,
    "responsavel_id" UUID,
    "prazo" DATE NOT NULL,
    "status" "StatusTarefa" NOT NULL DEFAULT 'pendente',
    "concluida_em" TIMESTAMP(3),
    "concluida_por" TEXT,
    "observacao" TEXT,
    "material_url" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tarefas_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_onboarding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "onboarding_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modelos_onboarding_tenant_id_nome_key" ON "modelos_onboarding"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "onboardings_tenant_id_status_idx" ON "onboardings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tarefas_onboarding_onboarding_id_ordem_idx" ON "tarefas_onboarding"("onboarding_id", "ordem");

-- CreateIndex
CREATE INDEX "tarefas_onboarding_tenant_id_status_prazo_idx" ON "tarefas_onboarding"("tenant_id", "status", "prazo");

-- CreateIndex
CREATE INDEX "eventos_onboarding_onboarding_id_criado_em_idx" ON "eventos_onboarding"("onboarding_id", "criado_em");

-- AddForeignKey
ALTER TABLE "etapas_modelo" ADD CONSTRAINT "etapas_modelo_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos_onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_modelo" ADD CONSTRAINT "tarefas_modelo_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas_modelo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos_onboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_onboarding" ADD CONSTRAINT "tarefas_onboarding_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_onboarding" ADD CONSTRAINT "tarefas_onboarding_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_onboarding" ADD CONSTRAINT "eventos_onboarding_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
