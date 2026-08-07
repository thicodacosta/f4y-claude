-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('pendente', 'concluida');

-- CreateEnum
CREATE TYPE "OrigemTarefa" AS ENUM ('manual', 'automacao');

-- CreateEnum
CREATE TYPE "EventoAutomacao" AS ENUM ('entrou_etapa', 'vencimento_sla');

-- CreateEnum
CREATE TYPE "ResultadoExecucao" AS ENUM ('sucesso', 'erro');

-- AlterTable
ALTER TABLE "regras_comissao" ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tarefas" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "entidade_tipo" "EntidadeTipo",
    "entidade_id" UUID,
    "responsavel_id" UUID NOT NULL,
    "prazo" DATE,
    "status" "StatusTarefa" NOT NULL DEFAULT 'pendente',
    "origem" "OrigemTarefa" NOT NULL DEFAULT 'manual',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT,
    "link" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automacoes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "pipeline_etapa_id" UUID,
    "evento" "EventoAutomacao" NOT NULL,
    "condicao" JSONB NOT NULL DEFAULT '{}',
    "acao" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automacao_execucoes" (
    "id" UUID NOT NULL,
    "automacao_id" UUID NOT NULL,
    "entidade_tipo" "EntidadeTipo" NOT NULL,
    "entidade_id" UUID NOT NULL,
    "resultado" "ResultadoExecucao" NOT NULL,
    "erro" TEXT,
    "executado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automacao_execucoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarefas_entidade_tipo_entidade_id_idx" ON "tarefas"("entidade_tipo", "entidade_id");

-- CreateIndex
CREATE INDEX "automacao_execucoes_automacao_id_entidade_id_idx" ON "automacao_execucoes"("automacao_id", "entidade_id");

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automacoes" ADD CONSTRAINT "automacoes_pipeline_etapa_id_fkey" FOREIGN KEY ("pipeline_etapa_id") REFERENCES "pipeline_etapas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automacao_execucoes" ADD CONSTRAINT "automacao_execucoes_automacao_id_fkey" FOREIGN KEY ("automacao_id") REFERENCES "automacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
