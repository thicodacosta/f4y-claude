-- CreateEnum
CREATE TYPE "VerticalNegocio" AS ENUM ('tecnologia', 'corporativo', 'executive_search', 'alocacao_tech');

-- CreateEnum
CREATE TYPE "StatusEmpresa" AS ENUM ('prospect', 'ativo', 'inativo');

-- CreateEnum
CREATE TYPE "PorteEmpresa" AS ENUM ('pequena', 'media', 'grande', 'enterprise');

-- CreateEnum
CREATE TYPE "TipoPipeline" AS ENUM ('comercial', 'vagas');

-- CreateEnum
CREATE TYPE "EntidadeTipo" AS ENUM ('oportunidade', 'vaga', 'candidato', 'empresa');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('nota', 'email', 'whatsapp', 'ligacao', 'reuniao', 'tarefa', 'mudanca_etapa', 'automacao');

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "segmento" TEXT,
    "porte" "PorteEmpresa",
    "cidade" TEXT,
    "estado" TEXT,
    "status" "StatusEmpresa" NOT NULL DEFAULT 'prospect',
    "origem" TEXT,
    "stack_tecnologica" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "linkedin" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "tipo" "TipoPipeline" NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_etapas" (
    "id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "sla_dias" INTEGER,
    "probabilidade_padrao" DECIMAL(5,2),
    "campos_obrigatorios" JSONB NOT NULL DEFAULT '[]',
    "is_ganho" BOOLEAN NOT NULL DEFAULT false,
    "is_perdido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pipeline_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "contato_id" UUID,
    "etapa_id" UUID NOT NULL,
    "responsavel_id" UUID,
    "vertical" "VerticalNegocio" NOT NULL,
    "origem" TEXT,
    "valor_estimado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "probabilidade" DECIMAL(5,2),
    "previsao_fechamento" DATE,
    "produtos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivo_perda" TEXT,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "fechado_em" TIMESTAMP(3),

    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" UUID NOT NULL,
    "entidade_tipo" "EntidadeTipo" NOT NULL,
    "entidade_id" UUID NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "autor_id" UUID,
    "conteudo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" UUID NOT NULL,
    "entidade_tipo" "EntidadeTipo" NOT NULL,
    "entidade_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER,
    "enviado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_tipo_key" ON "pipelines"("tipo");

-- CreateIndex
CREATE INDEX "atividades_entidade_tipo_entidade_id_idx" ON "atividades"("entidade_tipo", "entidade_id");

-- CreateIndex
CREATE INDEX "arquivos_entidade_tipo_entidade_id_idx" ON "arquivos"("entidade_tipo", "entidade_id");

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_etapas" ADD CONSTRAINT "pipeline_etapas_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "pipeline_etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
