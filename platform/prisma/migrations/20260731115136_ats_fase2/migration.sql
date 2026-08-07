-- CreateEnum
CREATE TYPE "PrioridadeVaga" AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "ModeloTrabalho" AS ENUM ('remoto', 'hibrido', 'presencial');

-- CreateEnum
CREATE TYPE "Senioridade" AS ENUM ('junior', 'pleno', 'senior', 'especialista');

-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('aberta', 'pausada', 'fechada', 'perdida');

-- CreateEnum
CREATE TYPE "Disponibilidade" AS ENUM ('imediata', 'quinze_dias', 'trinta_dias', 'indisponivel');

-- CreateEnum
CREATE TYPE "StatusCandidato" AS ENUM ('ativo', 'em_processo', 'alocado', 'inativo');

-- CreateEnum
CREATE TYPE "EtapaVagaCandidato" AS ENUM ('abertas', 'analise_rh', 'cv_enviado', 'entrevista_cliente', 'forecast', 'fechada', 'perdida');

-- CreateTable
CREATE TABLE "vagas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "oportunidade_origem_id" UUID,
    "etapa_id" UUID NOT NULL,
    "cargo" TEXT NOT NULL,
    "vertical" "VerticalNegocio" NOT NULL,
    "consultor_id" UUID,
    "recrutador_id" UUID,
    "quantidade_posicoes" INTEGER NOT NULL DEFAULT 1,
    "posicoes_preenchidas" INTEGER NOT NULL DEFAULT 0,
    "data_abertura" DATE,
    "data_limite" DATE,
    "sla_dias" INTEGER,
    "valor" DECIMAL(14,2),
    "prioridade" "PrioridadeVaga" NOT NULL DEFAULT 'media',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stack_tecnologica" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidencial" BOOLEAN NOT NULL DEFAULT false,
    "job_description" TEXT,
    "skills_requeridas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gestor_nome" TEXT,
    "gestor_contato" TEXT,
    "salario_min" DECIMAL(12,2),
    "salario_max" DECIMAL(12,2),
    "beneficios" TEXT,
    "modelo_trabalho" "ModeloTrabalho",
    "cidade" TEXT,
    "estado" TEXT,
    "senioridade" "Senioridade",
    "status" "StatusVaga" NOT NULL DEFAULT 'aberta',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "foto_url" TEXT,
    "cargo_atual" TEXT,
    "empresa_atual" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "portfolio_url" TEXT,
    "curriculo_url" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tecnologias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idiomas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificacoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pretensao_salarial" DECIMAL(12,2),
    "disponibilidade" "Disponibilidade",
    "status" "StatusCandidato" NOT NULL DEFAULT 'ativo',
    "score_ia" DECIMAL(5,2),
    "score_ia_gerado_em" TIMESTAMP(3),
    "score_ia_modelo" TEXT,
    "resumo_ia" TEXT,
    "observacoes" TEXT,
    "experiencias" JSONB NOT NULL DEFAULT '[]',
    "formacao" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaga_candidatos" (
    "id" UUID NOT NULL,
    "vaga_id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "etapa" "EtapaVagaCandidato" NOT NULL DEFAULT 'abertas',
    "fit_score" DECIMAL(5,2),
    "motivo_perda" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaga_candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaga_candidatos_vaga_id_candidato_id_key" ON "vaga_candidatos"("vaga_id", "candidato_id");

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_oportunidade_origem_id_fkey" FOREIGN KEY ("oportunidade_origem_id") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "pipeline_etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_consultor_id_fkey" FOREIGN KEY ("consultor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_recrutador_id_fkey" FOREIGN KEY ("recrutador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_candidatos" ADD CONSTRAINT "vaga_candidatos_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_candidatos" ADD CONSTRAINT "vaga_candidatos_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
