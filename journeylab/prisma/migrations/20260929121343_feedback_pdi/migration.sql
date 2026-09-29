-- CreateEnum
CREATE TYPE "StatusReuniao" AS ENUM ('agendada', 'realizada', 'cancelada');

-- CreateEnum
CREATE TYPE "VisibilidadeAnotacao" AS ENUM ('compartilhada', 'privada');

-- CreateEnum
CREATE TYPE "StatusCompromisso" AS ENUM ('aberto', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "StatusPdi" AS ENUM ('rascunho', 'ativo', 'concluido', 'arquivado');

-- CreateEnum
CREATE TYPE "StatusObjetivo" AS ENUM ('em_andamento', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoAcaoPdi" AS ENUM ('pratica', 'curso', 'mentoria', 'leitura', 'projeto', 'outro');

-- CreateEnum
CREATE TYPE "StatusAcaoPdi" AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoRegistroPdi" AS ENUM ('comentario', 'revisao', 'evento');

-- CreateTable
CREATE TABLE "modelos_pauta" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "itens" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_pauta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reunioes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "gestor_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "status" "StatusReuniao" NOT NULL DEFAULT 'agendada',
    "pauta" TEXT[],
    "modelo_nome" TEXT,
    "realizada_em" TIMESTAMP(3),
    "cancelada_motivo" TEXT,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reunioes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anotacoes_reuniao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reuniao_id" UUID NOT NULL,
    "autor_usuario_id" UUID NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "visibilidade" "VisibilidadeAnotacao" NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anotacoes_reuniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromissos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reuniao_id" UUID NOT NULL,
    "responsavel_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "prazo" DATE,
    "status" "StatusCompromisso" NOT NULL DEFAULT 'aberto',
    "concluido_em" TIMESTAMP(3),
    "concluido_por" TEXT,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compromissos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "status" "StatusPdi" NOT NULL DEFAULT 'rascunho',
    "concluido_em" TIMESTAMP(3),
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos_pdi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pdi_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "competencia" TEXT,
    "status" "StatusObjetivo" NOT NULL DEFAULT 'em_andamento',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objetivos_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acoes_pdi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pdi_id" UUID NOT NULL,
    "objetivo_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoAcaoPdi" NOT NULL DEFAULT 'pratica',
    "prazo" DATE,
    "status" "StatusAcaoPdi" NOT NULL DEFAULT 'pendente',
    "evidencia" TEXT,
    "evidencia_url" TEXT,
    "concluida_em" TIMESTAMP(3),
    "compromisso_origem_id" UUID,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acoes_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_pdi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pdi_id" UUID NOT NULL,
    "tipo" "TipoRegistroPdi" NOT NULL,
    "texto" TEXT NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_pdi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modelos_pauta_tenant_id_nome_key" ON "modelos_pauta"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "reunioes_tenant_id_data_hora_idx" ON "reunioes"("tenant_id", "data_hora");

-- CreateIndex
CREATE INDEX "reunioes_tenant_id_colaborador_id_idx" ON "reunioes"("tenant_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "reunioes_tenant_id_gestor_id_idx" ON "reunioes"("tenant_id", "gestor_id");

-- CreateIndex
CREATE INDEX "anotacoes_reuniao_reuniao_id_criado_em_idx" ON "anotacoes_reuniao"("reuniao_id", "criado_em");

-- CreateIndex
CREATE INDEX "compromissos_tenant_id_status_idx" ON "compromissos"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "compromissos_reuniao_id_idx" ON "compromissos"("reuniao_id");

-- CreateIndex
CREATE INDEX "pdis_tenant_id_status_idx" ON "pdis"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "pdis_tenant_id_colaborador_id_idx" ON "pdis"("tenant_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "objetivos_pdi_pdi_id_ordem_idx" ON "objetivos_pdi"("pdi_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "acoes_pdi_compromisso_origem_id_key" ON "acoes_pdi"("compromisso_origem_id");

-- CreateIndex
CREATE INDEX "acoes_pdi_pdi_id_idx" ON "acoes_pdi"("pdi_id");

-- CreateIndex
CREATE INDEX "acoes_pdi_tenant_id_status_prazo_idx" ON "acoes_pdi"("tenant_id", "status", "prazo");

-- CreateIndex
CREATE INDEX "registros_pdi_pdi_id_criado_em_idx" ON "registros_pdi"("pdi_id", "criado_em");

-- AddForeignKey
ALTER TABLE "reunioes" ADD CONSTRAINT "reunioes_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunioes" ADD CONSTRAINT "reunioes_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacoes_reuniao" ADD CONSTRAINT "anotacoes_reuniao_reuniao_id_fkey" FOREIGN KEY ("reuniao_id") REFERENCES "reunioes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromissos" ADD CONSTRAINT "compromissos_reuniao_id_fkey" FOREIGN KEY ("reuniao_id") REFERENCES "reunioes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromissos" ADD CONSTRAINT "compromissos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos_pdi" ADD CONSTRAINT "objetivos_pdi_pdi_id_fkey" FOREIGN KEY ("pdi_id") REFERENCES "pdis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_pdi_id_fkey" FOREIGN KEY ("pdi_id") REFERENCES "pdis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivos_pdi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_compromisso_origem_id_fkey" FOREIGN KEY ("compromisso_origem_id") REFERENCES "compromissos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_pdi" ADD CONSTRAINT "registros_pdi_pdi_id_fkey" FOREIGN KEY ("pdi_id") REFERENCES "pdis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
