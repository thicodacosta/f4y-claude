-- PDI v2: focos de desenvolvimento (catálogo), ações com responsável, datas,
-- progresso, investimento, impacto e mentor; status do plano passa a ser
-- CALCULADO pelas ações (coluna de status removida). Dados existentes preservados.

-- Enums novos
CREATE TYPE "ResponsavelAcaoPdi" AS ENUM ('colaborador', 'gestor', 'ambos');
CREATE TYPE "TipoComentarioAcaoPdi" AS ENUM ('comentario', 'fala_colaborador');

-- Ações canceladas deixam de existir no modelo (não fazem parte do plano).
DELETE FROM "acoes_pdi" WHERE "status" = 'cancelada';

-- Status da ação: pendente → nao_iniciada
CREATE TYPE "StatusAcaoPdi_new" AS ENUM ('nao_iniciada', 'em_andamento', 'concluida');
ALTER TABLE "acoes_pdi" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "acoes_pdi" ALTER COLUMN "status" TYPE "StatusAcaoPdi_new"
  USING (CASE "status"::text WHEN 'pendente' THEN 'nao_iniciada' ELSE "status"::text END)::"StatusAcaoPdi_new";
ALTER TYPE "StatusAcaoPdi" RENAME TO "StatusAcaoPdi_old";
ALTER TYPE "StatusAcaoPdi_new" RENAME TO "StatusAcaoPdi";
DROP TYPE "StatusAcaoPdi_old";
ALTER TABLE "acoes_pdi" ALTER COLUMN "status" SET DEFAULT 'nao_iniciada';

-- Tipo da ação: curso → treinamento; prática/projeto/outro → projeto_pratico
CREATE TYPE "TipoAcaoPdi_new" AS ENUM ('treinamento', 'mentoria', 'leitura', 'projeto_pratico');
ALTER TABLE "acoes_pdi" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "acoes_pdi" ALTER COLUMN "tipo" TYPE "TipoAcaoPdi_new"
  USING (CASE "tipo"::text WHEN 'curso' THEN 'treinamento' WHEN 'mentoria' THEN 'mentoria' WHEN 'leitura' THEN 'leitura' ELSE 'projeto_pratico' END)::"TipoAcaoPdi_new";
ALTER TYPE "TipoAcaoPdi" RENAME TO "TipoAcaoPdi_old";
ALTER TYPE "TipoAcaoPdi_new" RENAME TO "TipoAcaoPdi";
DROP TYPE "TipoAcaoPdi_old";
ALTER TABLE "acoes_pdi" ALTER COLUMN "tipo" SET DEFAULT 'projeto_pratico';

-- Focos (substituem objetivos; mesmos ids para manter o vínculo das ações)
CREATE TABLE "focos_pdi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pdi_id" UUID NOT NULL,
    "foco_chave" TEXT NOT NULL,
    "nome_personalizado" TEXT,
    "descricao" TEXT,
    "importancia" TEXT,
    "objetivo" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "focos_pdi_pkey" PRIMARY KEY ("id")
);
INSERT INTO "focos_pdi" ("id", "tenant_id", "pdi_id", "foco_chave", "nome_personalizado", "descricao", "objetivo", "ordem", "criado_em")
SELECT o."id", o."tenant_id", o."pdi_id",
       CASE lower(coalesce(o."competencia", ''))
         WHEN 'comunicação' THEN 'comunicacao' WHEN 'comunicacao' THEN 'comunicacao'
         WHEN 'liderança' THEN 'lideranca' WHEN 'lideranca' THEN 'lideranca'
         WHEN 'negociação' THEN 'negociacao' WHEN 'gestão do tempo' THEN 'gestao_tempo'
         ELSE 'outro' END,
       coalesce(nullif(o."competencia", ''), left(o."titulo", 80)),
       o."descricao", o."titulo", o."ordem", o."criado_em"
  FROM "objetivos_pdi" o;
UPDATE "focos_pdi" SET "nome_personalizado" = NULL WHERE "foco_chave" <> 'outro';

-- Ações: novos campos; título → descrição; objetivo → foco
ALTER TABLE "acoes_pdi" RENAME COLUMN "titulo" TO "descricao";
ALTER TABLE "acoes_pdi" RENAME COLUMN "objetivo_id" TO "foco_id";
ALTER TABLE "acoes_pdi" DROP CONSTRAINT "acoes_pdi_objetivo_id_fkey";
ALTER TABLE "acoes_pdi"
  ADD COLUMN "impacto" TEXT,
  ADD COLUMN "inicio" DATE,
  ADD COLUMN "investimento" DECIMAL(12,2),
  ADD COLUMN "mentor" TEXT,
  ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progresso" SMALLINT,
  ADD COLUMN "responsavel" "ResponsavelAcaoPdi" NOT NULL DEFAULT 'colaborador';
UPDATE "acoes_pdi" SET "progresso" = 100 WHERE "status" = 'concluida';
DROP INDEX IF EXISTS "acoes_pdi_objetivo_id_idx";

DROP TABLE "objetivos_pdi";

-- PDI: descrição; status calculado (coluna removida, com o índice parcial que dependia dela)
DROP INDEX IF EXISTS "pdi_um_aberto";
DROP INDEX IF EXISTS "pdis_tenant_id_status_idx";
ALTER TABLE "pdis" DROP COLUMN "concluido_em", DROP COLUMN "status", ADD COLUMN "descricao" TEXT;
DROP TYPE "StatusObjetivo";
DROP TYPE "StatusPdi";

-- Comentários por ação (RH/gestor; fala do colaborador registrada por quem acompanha)
CREATE TABLE "comentarios_acao_pdi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pdi_id" UUID NOT NULL,
    "acao_id" UUID NOT NULL,
    "tipo" "TipoComentarioAcaoPdi" NOT NULL DEFAULT 'comentario',
    "texto" TEXT NOT NULL,
    "autor_usuario_id" UUID NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comentarios_acao_pdi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "focos_pdi_pdi_id_ordem_idx" ON "focos_pdi"("pdi_id", "ordem");
CREATE INDEX "comentarios_acao_pdi_acao_id_criado_em_idx" ON "comentarios_acao_pdi"("acao_id", "criado_em");
CREATE INDEX "acoes_pdi_foco_id_ordem_idx" ON "acoes_pdi"("foco_id", "ordem");
ALTER TABLE "focos_pdi" ADD CONSTRAINT "focos_pdi_pdi_id_fkey" FOREIGN KEY ("pdi_id") REFERENCES "pdis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_foco_id_fkey" FOREIGN KEY ("foco_id") REFERENCES "focos_pdi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_acao_pdi" ADD CONSTRAINT "comentarios_acao_pdi_pdi_id_fkey" FOREIGN KEY ("pdi_id") REFERENCES "pdis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_acao_pdi" ADD CONSTRAINT "comentarios_acao_pdi_acao_id_fkey" FOREIGN KEY ("acao_id") REFERENCES "acoes_pdi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regras de dados
ALTER TABLE "focos_pdi" ADD CONSTRAINT "focos_pdi_chave_valida" CHECK ("foco_chave" IN (
  'visao_negocio','pensamento_critico','networking','inovacao','analise_dados','resiliencia','estudo_continuo',
  'foco_concentracao','negociacao','resolucao_conflitos','mentoria','escrita_assertiva','agilidade','gestao_projetos',
  'delegacao','tomada_decisao','produtividade','performance','comunicacao','gestao_tempo','lideranca','outro'));
ALTER TABLE "focos_pdi" ADD CONSTRAINT "focos_pdi_outro_com_nome" CHECK ("foco_chave" <> 'outro' OR length(trim(coalesce("nome_personalizado", ''))) >= 2);
CREATE UNIQUE INDEX "focos_pdi_sem_repetir" ON "focos_pdi" ("pdi_id", "foco_chave") WHERE "foco_chave" <> 'outro';
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_progresso_faixa" CHECK ("progresso" IS NULL OR "progresso" BETWEEN 0 AND 100);
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_progresso_status" CHECK (
  ("status" = 'concluida' AND "progresso" = 100)
  OR ("status" = 'nao_iniciada' AND "progresso" IS NULL)
  OR ("status" = 'em_andamento' AND ("progresso" IS NULL OR "progresso" BETWEEN 1 AND 99)));
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_investimento_positivo" CHECK ("investimento" IS NULL OR "investimento" >= 0);
ALTER TABLE "acoes_pdi" ADD CONSTRAINT "acoes_pdi_datas" CHECK ("inicio" IS NULL OR "prazo" IS NULL OR "prazo" >= "inicio");
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_periodo" CHECK ("fim" >= "inicio");

-- Permissões padrão: RH cria, edita e exporta PDIs; colaborador não acessa o módulo nesta versão.
INSERT INTO "papel_permissoes" ("id", "tenant_id", "papel_id", "area", "acao", "escopo")
SELECT gen_random_uuid(), p.tenant_id, p.id, 'pdi', a.acao::"Acao", 'todos'
  FROM "papeis" p CROSS JOIN (VALUES ('visualizar'), ('criar'), ('editar'), ('exportar')) AS a(acao)
 WHERE p.base = 'rh'
ON CONFLICT ("papel_id", "area", "acao") DO UPDATE SET "escopo" = 'todos';
DELETE FROM "papel_permissoes" pp USING "papeis" p
 WHERE pp.papel_id = p.id AND p.base = 'colaborador' AND pp.area = 'pdi';
