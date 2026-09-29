-- CreateEnum
CREATE TYPE "StatusPesquisa" AS ENUM ('rascunho', 'aberta', 'encerrada');

-- CreateEnum
CREATE TYPE "TipoPergunta" AS ENUM ('escala', 'enps', 'sim_nao', 'texto');

-- CreateTable
CREATE TABLE "pesquisas_pulse" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusPesquisa" NOT NULL DEFAULT 'rascunho',
    "publico_todos" BOOLEAN NOT NULL DEFAULT true,
    "equipe_ids" UUID[],
    "encerra_em" DATE,
    "aberta_em" TIMESTAMP(3),
    "encerrada_em" TIMESTAMP(3),
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisas_pulse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas_pulse" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pesquisa_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "tipo" "TipoPergunta" NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "perguntas_pulse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacoes_pulse" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pesquisa_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "respondido_em" DATE NOT NULL,

    CONSTRAINT "participacoes_pulse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_pulse" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pesquisa_id" UUID NOT NULL,
    "pergunta_id" UUID NOT NULL,
    "lote" UUID NOT NULL,
    "equipe_id" UUID,
    "valor" INTEGER,
    "texto" TEXT,

    CONSTRAINT "respostas_pulse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pesquisas_pulse_tenant_id_status_idx" ON "pesquisas_pulse"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "perguntas_pulse_pesquisa_id_ordem_idx" ON "perguntas_pulse"("pesquisa_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "participacoes_pulse_pesquisa_id_colaborador_id_key" ON "participacoes_pulse"("pesquisa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "respostas_pulse_pesquisa_id_pergunta_id_idx" ON "respostas_pulse"("pesquisa_id", "pergunta_id");

-- AddForeignKey
ALTER TABLE "perguntas_pulse" ADD CONSTRAINT "perguntas_pulse_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas_pulse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes_pulse" ADD CONSTRAINT "participacoes_pulse_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas_pulse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
