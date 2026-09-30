-- Página de Carreiras: vagas publicáveis (URL estável por slug), criador com e-mail
-- de notificação confirmado, candidaturas com origem, currículo enviado e status do aviso.

ALTER TABLE "vagas"
  ADD COLUMN "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "criado_por_usuario_id" UUID,
  ADD COLUMN "email_confirmado_em" TIMESTAMP(3),
  ADD COLUMN "email_notificacao" TEXT,
  ADD COLUMN "publicada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicada_em" TIMESTAMP(3),
  ADD COLUMN "requisitos" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "tipo_contratacao" TEXT;

-- Slug das vagas existentes: título sem acentos + 6 caracteres do id (estável e único).
UPDATE "vagas" SET "slug" =
  trim(both '-' from regexp_replace(lower(translate("titulo",
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'))
  || '-' || left(replace("id"::text, '-', ''), 6);
ALTER TABLE "vagas" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_slug_formato" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
-- Publicada exige e-mail de notificação confirmado.
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_publicada_email" CHECK (NOT "publicada" OR ("email_notificacao" IS NOT NULL AND "email_confirmado_em" IS NOT NULL));

ALTER TABLE "candidaturas"
  ADD COLUMN "anexo_id" UUID,
  ADD COLUMN "notificacao_em" TIMESTAMP(3),
  ADD COLUMN "notificacao_erro" TEXT,
  ADD COLUMN "notificacao_status" TEXT,
  ADD COLUMN "notificacao_tentativas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'interno';
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_origem" CHECK ("origem" IN ('interno', 'carreiras'));
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_notificacao" CHECK ("notificacao_status" IS NULL OR "notificacao_status" IN ('pendente', 'enviado', 'falhou'));

CREATE INDEX "candidaturas_tenant_id_notificacao_status_idx" ON "candidaturas"("tenant_id", "notificacao_status");
CREATE INDEX "vagas_tenant_id_publicada_idx" ON "vagas"("tenant_id", "publicada");
CREATE UNIQUE INDEX "vagas_tenant_id_slug_key" ON "vagas"("tenant_id", "slug");
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_anexo_id_fkey" FOREIGN KEY ("anexo_id") REFERENCES "anexos_candidato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
