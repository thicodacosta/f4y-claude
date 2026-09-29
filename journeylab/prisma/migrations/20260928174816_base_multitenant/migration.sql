-- CreateEnum
CREATE TYPE "Modulo" AS ENUM ('crm', 'onboarding', 'feedback', 'pulse', 'pdi', 'nr1');

-- CreateEnum
CREATE TYPE "StatusEntitlement" AS ENUM ('ativo', 'teste', 'inativo', 'suspenso', 'expirado');

-- CreateEnum
CREATE TYPE "OrigemEntitlement" AS ENUM ('manual', 'kiwify', 'site', 'sistema');

-- CreateEnum
CREATE TYPE "PapelBase" AS ENUM ('admin_org', 'rh', 'gestor', 'colaborador', 'personalizado');

-- CreateEnum
CREATE TYPE "AreaPermissao" AS ENUM ('organizacao', 'cadastro', 'crm', 'onboarding', 'feedback', 'pulse', 'pdi', 'nr1');

-- CreateEnum
CREATE TYPE "Acao" AS ENUM ('visualizar', 'criar', 'editar', 'concluir', 'exportar', 'administrar');

-- CreateEnum
CREATE TYPE "Escopo" AS ENUM ('proprio', 'equipe', 'todos');

-- CreateEnum
CREATE TYPE "StatusAssociacao" AS ENUM ('ativa', 'suspensa');

-- CreateEnum
CREATE TYPE "StatusColaborador" AS ENUM ('pre_admissao', 'ativo', 'desligado');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('kiwify', 'site');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('recebido', 'processado', 'ignorado', 'erro');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "superadmin" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "aceito" BOOLEAN NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizacoes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "documento" TEXT,
    "identificadores_externos" TEXT[],
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "minimo_recorte" INTEGER NOT NULL DEFAULT 5,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos_externos" (
    "id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "id_externo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "modulos" "Modulo"[],
    "duracao_dias" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_externos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "modulo" "Modulo" NOT NULL,
    "status" "StatusEntitlement" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "origem" "OrigemEntitlement" NOT NULL,
    "referencia_externa" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_entitlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entitlement_id" UUID NOT NULL,
    "modulo" "Modulo" NOT NULL,
    "status_anterior" "StatusEntitlement",
    "status_novo" "StatusEntitlement" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "origem" "OrigemEntitlement" NOT NULL,
    "responsavel_id" UUID,
    "responsavel_nome" TEXT NOT NULL,
    "motivo" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acessos_suporte" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "superadmin_id" UUID NOT NULL,
    "superadmin_nome" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "encerrado_em" TIMESTAMP(3),

    CONSTRAINT "acessos_suporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_integracao" (
    "id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corpo" JSONB,
    "corpo_bruto" TEXT,
    "cabecalhos" JSONB,
    "consulta" TEXT,
    "token_conferido" BOOLEAN,
    "status" "StatusEvento" NOT NULL DEFAULT 'recebido',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "processado_em" TIMESTAMP(3),

    CONSTRAINT "eventos_integracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "usuario_id" UUID,
    "usuario_nome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "detalhes" JSONB,
    "suporte" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papeis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "base" "PapelBase" NOT NULL,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papeis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papel_permissoes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "papel_id" UUID NOT NULL,
    "area" "AreaPermissao" NOT NULL,
    "acao" "Acao" NOT NULL,
    "escopo" "Escopo" NOT NULL,

    CONSTRAINT "papel_permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associacoes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "papel_id" UUID NOT NULL,
    "colaborador_id" UUID,
    "status" "StatusAssociacao" NOT NULL DEFAULT 'ativa',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "associacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "papel_id" UUID NOT NULL,
    "colaborador_id" UUID,
    "convidado_por" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "area_id" UUID,
    "gestor_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "cargo" TEXT,
    "equipe_id" UUID,
    "gestor_id" UUID,
    "data_admissao" DATE,
    "status" "StatusColaborador" NOT NULL DEFAULT 'ativo',
    "candidato_origem_id" UUID,
    "desligado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "consentimentos_usuario_id_tipo_idx" ON "consentimentos"("usuario_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "organizacoes_slug_key" ON "organizacoes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_externos_canal_id_externo_key" ON "produtos_externos"("canal", "id_externo");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_tenant_id_modulo_key" ON "entitlements"("tenant_id", "modulo");

-- CreateIndex
CREATE INDEX "historico_entitlements_tenant_id_criado_em_idx" ON "historico_entitlements"("tenant_id", "criado_em");

-- CreateIndex
CREATE INDEX "acessos_suporte_superadmin_id_expira_em_idx" ON "acessos_suporte"("superadmin_id", "expira_em");

-- CreateIndex
CREATE INDEX "eventos_integracao_canal_recebido_em_idx" ON "eventos_integracao"("canal", "recebido_em");

-- CreateIndex
CREATE INDEX "auditoria_tenant_id_criado_em_idx" ON "auditoria"("tenant_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "papeis_tenant_id_nome_key" ON "papeis"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "papel_permissoes_papel_id_area_acao_key" ON "papel_permissoes"("papel_id", "area", "acao");

-- CreateIndex
CREATE UNIQUE INDEX "associacoes_colaborador_id_key" ON "associacoes"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "associacoes_tenant_id_usuario_id_key" ON "associacoes"("tenant_id", "usuario_id");

-- CreateIndex
CREATE INDEX "convites_tenant_id_email_idx" ON "convites"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "areas_tenant_id_nome_key" ON "areas"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_tenant_id_nome_key" ON "equipes"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_candidato_origem_id_key" ON "colaboradores"("candidato_origem_id");

-- CreateIndex
CREATE INDEX "colaboradores_tenant_id_status_idx" ON "colaboradores"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "colaboradores_tenant_id_gestor_id_idx" ON "colaboradores"("tenant_id", "gestor_id");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_tenant_id_email_key" ON "colaboradores"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_entitlements" ADD CONSTRAINT "historico_entitlements_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papeis" ADD CONSTRAINT "papeis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_permissoes" ADD CONSTRAINT "papel_permissoes_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papeis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associacoes" ADD CONSTRAINT "associacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associacoes" ADD CONSTRAINT "associacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associacoes" ADD CONSTRAINT "associacoes_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papeis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associacoes" ADD CONSTRAINT "associacoes_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papeis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
