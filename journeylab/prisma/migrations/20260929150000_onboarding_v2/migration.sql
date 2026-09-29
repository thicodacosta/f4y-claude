-- Onboarding v2: fases relacionais, status de tarefa ampliado, progresso, templates por área.
-- Migração com preservação de dados (os onboardings existentes são convertidos).

-- 1. Status de tarefa: pendente → nao_iniciada; novos: em_andamento, bloqueada.
CREATE TYPE "StatusTarefa_new" AS ENUM ('nao_iniciada', 'em_andamento', 'bloqueada', 'concluida', 'dispensada');
ALTER TABLE "tarefas_onboarding" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tarefas_onboarding" ALTER COLUMN "status" TYPE "StatusTarefa_new"
  USING (CASE WHEN "status"::text = 'pendente' THEN 'nao_iniciada' ELSE "status"::text END)::"StatusTarefa_new";
ALTER TYPE "StatusTarefa" RENAME TO "StatusTarefa_old";
ALTER TYPE "StatusTarefa_new" RENAME TO "StatusTarefa";
DROP TYPE "StatusTarefa_old";
ALTER TABLE "tarefas_onboarding" ALTER COLUMN "status" SET DEFAULT 'nao_iniciada';

-- 2. Templates: fases com descrição e marco; tarefas com obrigatoriedade e prazo opcional; área e padrão.
ALTER TABLE "etapas_modelo" ADD COLUMN "descricao" TEXT, ADD COLUMN "marco_dias" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "tarefas_modelo" ADD COLUMN "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
  ALTER COLUMN "prazo_dias" DROP NOT NULL, ALTER COLUMN "prazo_dias" DROP DEFAULT;
ALTER TABLE "modelos_onboarding" ADD COLUMN "padrao" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "area_id" UUID;
ALTER TABLE "modelos_onboarding" ADD CONSTRAINT "modelos_onboarding_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Marco das fases existentes = maior prazo das tarefas da fase (mínimo 1 dia).
UPDATE "etapas_modelo" e SET "marco_dias" = GREATEST(1, COALESCE((SELECT MAX(t."prazo_dias") FROM "tarefas_modelo" t WHERE t."etapa_id" = e."id"), 30));

-- 3. Onboarding: progresso, origem, lembrete, atualização.
ALTER TABLE "onboardings" ADD COLUMN "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lembrete_em" TIMESTAMP(3),
  ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "progresso" INTEGER NOT NULL DEFAULT 0;

-- 4. Fases da instância (substituem o texto "etapa" das tarefas).
CREATE TABLE "fases_onboarding" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "onboarding_id" UUID NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "marco_dias" INTEGER NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "fases_onboarding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fases_onboarding_onboarding_id_ordem_idx" ON "fases_onboarding"("onboarding_id", "ordem");
ALTER TABLE "fases_onboarding" ADD CONSTRAINT "fases_onboarding_onboarding_id_fkey"
  FOREIGN KEY ("onboarding_id") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "fases_onboarding" ("id", "tenant_id", "onboarding_id", "nome", "marco_dias", "ordem")
SELECT gen_random_uuid(), x.tenant_id, x.onboarding_id, x.etapa,
       GREATEST(1, x.marco), ROW_NUMBER() OVER (PARTITION BY x.onboarding_id ORDER BY x.primeira) - 1
FROM (
  SELECT t.tenant_id, t.onboarding_id, t.etapa, MIN(t.ordem) AS primeira, MAX(t.prazo - o.inicio) AS marco
  FROM "tarefas_onboarding" t JOIN "onboardings" o ON o.id = t.onboarding_id
  GROUP BY t.tenant_id, t.onboarding_id, t.etapa
) x;

ALTER TABLE "tarefas_onboarding" ADD COLUMN "fase_id" UUID,
  ADD COLUMN "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "bloqueio_motivo" TEXT,
  ADD COLUMN "iniciada_em" TIMESTAMP(3),
  ADD COLUMN "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "prazo_dias" INTEGER,
  ADD COLUMN "prazo_fixo" BOOLEAN NOT NULL DEFAULT false;
UPDATE "tarefas_onboarding" t
   SET "fase_id" = f.id, "prazo_dias" = (t.prazo - o.inicio)
  FROM "fases_onboarding" f, "onboardings" o
 WHERE f.onboarding_id = t.onboarding_id AND f.nome = t.etapa AND o.id = t.onboarding_id;
ALTER TABLE "tarefas_onboarding" ALTER COLUMN "fase_id" SET NOT NULL, DROP COLUMN "etapa";
ALTER TABLE "tarefas_onboarding" ADD CONSTRAINT "tarefas_onboarding_fase_id_fkey"
  FOREIGN KEY ("fase_id") REFERENCES "fases_onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Progresso inicial dos onboardings existentes.
UPDATE "onboardings" o SET "progresso" = COALESCE((
  SELECT CASE WHEN COUNT(*) FILTER (WHERE t.status <> 'dispensada') = 0 THEN 0
         ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'concluida') / COUNT(*) FILTER (WHERE t.status <> 'dispensada')) END
  FROM "tarefas_onboarding" t WHERE t.onboarding_id = o.id), 0);

-- 5. Anexos de tarefas (storage privado, mesmo padrão do CRM).
CREATE TABLE "anexos_tarefa_onboarding" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "tarefa_id" UUID NOT NULL,
  "nome_arquivo" TEXT NOT NULL,
  "caminho" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "mime" TEXT NOT NULL,
  "enviado_por" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anexos_tarefa_onboarding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "anexos_tarefa_onboarding_caminho_key" ON "anexos_tarefa_onboarding"("caminho");
CREATE INDEX "anexos_tarefa_onboarding_tarefa_id_idx" ON "anexos_tarefa_onboarding"("tarefa_id");
ALTER TABLE "anexos_tarefa_onboarding" ADD CONSTRAINT "anexos_tarefa_onboarding_tarefa_id_fkey"
  FOREIGN KEY ("tarefa_id") REFERENCES "tarefas_onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Colaborador não acessa o Onboarding nesta versão: remove permissões do papel padrão "colaborador".
DELETE FROM "papel_permissoes" pp USING "papeis" p
 WHERE pp.papel_id = p.id AND p.base = 'colaborador' AND pp.area = 'onboarding';
