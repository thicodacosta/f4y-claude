-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('aberta', 'pausada', 'fechada', 'cancelada');

-- CreateEnum
CREATE TYPE "StatusCandidatura" AS ENUM ('inscrito', 'em_avaliacao', 'entrevista', 'aprovado', 'reprovado', 'contratado', 'desistiu');

-- CreateEnum
CREATE TYPE "TipoInteracao" AS ENUM ('nota', 'ligacao', 'email', 'entrevista', 'sistema');

-- CreateTable
CREATE TABLE "candidatos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "linkedin" TEXT,
    "experiencia" TEXT,
    "competencias" TEXT[],
    "observacoes" TEXT,
    "origem" TEXT,
    "base_legal" TEXT,
    "email_norm" TEXT,
    "telefone_norm" TEXT,
    "linkedin_norm" TEXT,
    "nome_norm" TEXT NOT NULL,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatos_tags" (
    "tenant_id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "candidatos_tags_pkey" PRIMARY KEY ("candidato_id","tag_id")
);

-- CreateTable
CREATE TABLE "interacoes_candidato" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "tipo" "TipoInteracao" NOT NULL,
    "texto" TEXT NOT NULL,
    "autor_id" UUID,
    "autor_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacoes_candidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos_candidato" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "enviado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_candidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "equipe_id" UUID,
    "gestor_id" UUID,
    "local" TEXT,
    "modelo" TEXT,
    "status" "StatusVaga" NOT NULL DEFAULT 'aberta',
    "aberta_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechada_em" TIMESTAMP(3),
    "criado_por" TEXT NOT NULL,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidaturas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vaga_id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "status" "StatusCandidatura" NOT NULL DEFAULT 'inscrito',
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidatos_tenant_id_nome_norm_idx" ON "candidatos"("tenant_id", "nome_norm");

-- CreateIndex
CREATE INDEX "candidatos_tenant_id_email_norm_idx" ON "candidatos"("tenant_id", "email_norm");

-- CreateIndex
CREATE INDEX "candidatos_tenant_id_telefone_norm_idx" ON "candidatos"("tenant_id", "telefone_norm");

-- CreateIndex
CREATE INDEX "candidatos_tenant_id_linkedin_norm_idx" ON "candidatos"("tenant_id", "linkedin_norm");

-- CreateIndex
CREATE UNIQUE INDEX "tags_tenant_id_nome_key" ON "tags"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "interacoes_candidato_candidato_id_criado_em_idx" ON "interacoes_candidato"("candidato_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "anexos_candidato_caminho_key" ON "anexos_candidato"("caminho");

-- CreateIndex
CREATE INDEX "vagas_tenant_id_status_idx" ON "vagas"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "candidaturas_tenant_id_status_idx" ON "candidaturas"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidaturas_vaga_id_candidato_id_key" ON "candidaturas"("vaga_id", "candidato_id");

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_candidato_origem_id_fkey" FOREIGN KEY ("candidato_origem_id") REFERENCES "candidatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos_tags" ADD CONSTRAINT "candidatos_tags_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos_tags" ADD CONSTRAINT "candidatos_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes_candidato" ADD CONSTRAINT "interacoes_candidato_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_candidato" ADD CONSTRAINT "anexos_candidato_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
