-- CreateEnum
CREATE TYPE "StatusCiclo" AS ENUM ('rascunho', 'aberto', 'encerrado');

-- CreateEnum
CREATE TYPE "PrioridadeRisco" AS ENUM ('baixa', 'media', 'alta');

-- CreateEnum
CREATE TYPE "StatusRisco" AS ENUM ('identificado', 'em_tratamento', 'monitorado', 'encerrado');

-- CreateEnum
CREATE TYPE "StatusAcaoNr1" AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- CreateTable
CREATE TABLE "ciclos_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusCiclo" NOT NULL DEFAULT 'rascunho',
    "publico_todos" BOOLEAN NOT NULL DEFAULT true,
    "equipe_ids" UUID[],
    "encerra_em" DATE,
    "aberto_em" TIMESTAMP(3),
    "encerrado_em" TIMESTAMP(3),
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ciclos_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensoes_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dimensoes_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "dimensao_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "invertida" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "perguntas_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacoes_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "respondido_em" DATE NOT NULL,

    CONSTRAINT "participacoes_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "pergunta_id" UUID NOT NULL,
    "lote" UUID NOT NULL,
    "equipe_id" UUID,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "respostas_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riscos_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "dimensao_id" UUID,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "prioridade" "PrioridadeRisco" NOT NULL,
    "status" "StatusRisco" NOT NULL DEFAULT 'identificado',
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riscos_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acoes_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "risco_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "responsavel_nome" TEXT NOT NULL,
    "prazo" DATE,
    "status" "StatusAcaoNr1" NOT NULL DEFAULT 'pendente',
    "evidencia" TEXT,
    "concluida_em" TIMESTAMP(3),
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acoes_nr1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ciclos_nr1_tenant_id_status_idx" ON "ciclos_nr1"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "dimensoes_nr1_ciclo_id_ordem_idx" ON "dimensoes_nr1"("ciclo_id", "ordem");

-- CreateIndex
CREATE INDEX "perguntas_nr1_ciclo_id_ordem_idx" ON "perguntas_nr1"("ciclo_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "participacoes_nr1_ciclo_id_colaborador_id_key" ON "participacoes_nr1"("ciclo_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "respostas_nr1_ciclo_id_pergunta_id_idx" ON "respostas_nr1"("ciclo_id", "pergunta_id");

-- CreateIndex
CREATE INDEX "riscos_nr1_tenant_id_status_idx" ON "riscos_nr1"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "acoes_nr1_tenant_id_status_prazo_idx" ON "acoes_nr1"("tenant_id", "status", "prazo");

-- AddForeignKey
ALTER TABLE "dimensoes_nr1" ADD CONSTRAINT "dimensoes_nr1_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas_nr1" ADD CONSTRAINT "perguntas_nr1_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas_nr1" ADD CONSTRAINT "perguntas_nr1_dimensao_id_fkey" FOREIGN KEY ("dimensao_id") REFERENCES "dimensoes_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes_nr1" ADD CONSTRAINT "participacoes_nr1_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_nr1" ADD CONSTRAINT "respostas_nr1_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_nr1" ADD CONSTRAINT "respostas_nr1_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "perguntas_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riscos_nr1" ADD CONSTRAINT "riscos_nr1_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riscos_nr1" ADD CONSTRAINT "riscos_nr1_dimensao_id_fkey" FOREIGN KEY ("dimensao_id") REFERENCES "dimensoes_nr1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_nr1" ADD CONSTRAINT "acoes_nr1_risco_id_fkey" FOREIGN KEY ("risco_id") REFERENCES "riscos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;
