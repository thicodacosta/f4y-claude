-- Diagnóstico NR-1 v2: 13 fatores, pontuação de EXPOSIÇÃO (item positivo = reverso),
-- tipos de questionário, audiência por departamento/pessoa, convites de uso único
-- separados das respostas, departamento opcional informado pelo respondente,
-- faixas/escala/metodologia congeladas, matriz indicativa revisável e plano com origem.

CREATE TYPE "TipoDiagnosticoNr1" AS ENUM ('completo', 'rapido', 'personalizado');

-- Ciclos: audiência e metadados da metodologia
ALTER TABLE "ciclos_nr1"
  ADD COLUMN "ai_sugestoes" JSONB,
  ADD COLUMN "ai_sugestoes_em" TIMESTAMP(3),
  ADD COLUMN "area_ids" UUID[],
  ADD COLUMN "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "audiencia_tipo" TEXT NOT NULL DEFAULT 'todos',
  ADD COLUMN "colaborador_ids" UUID[],
  ADD COLUMN "coletar_departamento" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "data_inicio" DATE,
  ADD COLUMN "escala" JSONB,
  ADD COLUMN "faixas" INTEGER[] DEFAULT ARRAY[20, 40, 60, 80]::INTEGER[],
  ADD COLUMN "lembrete_em" TIMESTAMP(3),
  ADD COLUMN "matriz_revisada_em" TIMESTAMP(3),
  ADD COLUMN "matriz_revisada_por" TEXT,
  ADD COLUMN "mensagem_convite" TEXT,
  ADD COLUMN "metodologia_versao" TEXT NOT NULL DEFAULT 'jl-nr1-2026.1',
  ADD COLUMN "publico_total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tipo" "TipoDiagnosticoNr1" NOT NULL DEFAULT 'completo';
-- Ciclos anteriores usavam outro questionário: marcados como não comparáveis.
UPDATE "ciclos_nr1" SET "metodologia_versao" = 'legado', "tipo" = 'personalizado', "data_inicio" = "aberto_em"::date;
UPDATE "ciclos_nr1" c SET "audiencia_tipo" = 'departamentos',
       "area_ids" = coalesce((SELECT array_agg(DISTINCT e."area_id") FROM "equipes" e WHERE e."id" = ANY (c."equipe_ids") AND e."area_id" IS NOT NULL), '{}')
 WHERE NOT c."publico_todos";
UPDATE "ciclos_nr1" SET "publico_total" = coalesce((SELECT count(*) FROM "participacoes_nr1" p WHERE p."ciclo_id" = "ciclos_nr1"."id"), 0);
ALTER TABLE "ciclos_nr1" DROP COLUMN "equipe_ids", DROP COLUMN "publico_todos";
ALTER TABLE "ciclos_nr1" ADD CONSTRAINT "ciclos_nr1_audiencia" CHECK ("audiencia_tipo" IN ('todos', 'departamentos', 'colaboradores'));
ALTER TABLE "ciclos_nr1" ADD CONSTRAINT "ciclos_nr1_datas" CHECK ("data_inicio" IS NULL OR "encerra_em" IS NULL OR "encerra_em" >= "data_inicio");

-- Fatores e perguntas: direção passa a ser de exposição.
ALTER TABLE "dimensoes_nr1" ADD COLUMN "fator_chave" TEXT, ADD COLUMN "severidade" SMALLINT NOT NULL DEFAULT 2;
ALTER TABLE "dimensoes_nr1" ADD CONSTRAINT "dimensoes_nr1_severidade" CHECK ("severidade" BETWEEN 1 AND 3);
ALTER TABLE "perguntas_nr1" ADD COLUMN "chave" TEXT, ADD COLUMN "reversa" BOOLEAN NOT NULL DEFAULT false;
-- Antes: "invertida" = frequência alta é desfavorável (pontuação direta de exposição).
UPDATE "perguntas_nr1" SET "reversa" = NOT "invertida";
ALTER TABLE "perguntas_nr1" DROP COLUMN "invertida";

-- Respostas: departamento (área) no lugar de equipe.
ALTER TABLE "respostas_nr1" ADD COLUMN "area_id" UUID;
UPDATE "respostas_nr1" r SET "area_id" = e."area_id" FROM "equipes" e WHERE e."id" = r."equipe_id";
ALTER TABLE "respostas_nr1" DROP COLUMN "equipe_id";
ALTER TABLE "respostas_nr1" ADD CONSTRAINT "respostas_nr1_valor" CHECK ("valor" BETWEEN 1 AND 5);

-- Plano de ação: origem e revisão humana.
ALTER TABLE "riscos_nr1" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'humano', ADD COLUMN "revisado_em" TIMESTAMP(3), ADD COLUMN "revisado_por" TEXT;
ALTER TABLE "acoes_nr1" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'humano', ADD COLUMN "revisado_em" TIMESTAMP(3), ADD COLUMN "revisado_por" TEXT;
ALTER TABLE "riscos_nr1" ADD CONSTRAINT "riscos_nr1_origem" CHECK ("origem" IN ('humano', 'ia'));
ALTER TABLE "acoes_nr1" ADD CONSTRAINT "acoes_nr1_origem" CHECK ("origem" IN ('humano', 'ia'));

-- Participação por pessoa deixa de existir: convites + uso (sem data) separados das respostas.
DROP TABLE "participacoes_nr1";
CREATE TABLE "convites_nr1" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "enviado_em" TIMESTAMP(3),
    "erro" TEXT,
    CONSTRAINT "convites_nr1_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "usos_convite_nr1" (
    "convite_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    CONSTRAINT "usos_convite_nr1_pkey" PRIMARY KEY ("convite_id")
);
CREATE UNIQUE INDEX "convites_nr1_ciclo_id_colaborador_id_key" ON "convites_nr1"("ciclo_id", "colaborador_id");
CREATE INDEX "usos_convite_nr1_ciclo_id_idx" ON "usos_convite_nr1"("ciclo_id");
ALTER TABLE "convites_nr1" ADD CONSTRAINT "convites_nr1_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usos_convite_nr1" ADD CONSTRAINT "usos_convite_nr1_convite_id_fkey" FOREIGN KEY ("convite_id") REFERENCES "convites_nr1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissões padrão: RH administra o Diagnóstico NR-1; colaborador não acessa o módulo interno.
INSERT INTO "papel_permissoes" ("id", "tenant_id", "papel_id", "area", "acao", "escopo")
SELECT gen_random_uuid(), p.tenant_id, p.id, 'nr1', a.acao::"Acao", 'todos'
  FROM "papeis" p CROSS JOIN (VALUES ('visualizar'), ('criar'), ('editar'), ('concluir'), ('exportar')) AS a(acao)
 WHERE p.base = 'rh'
ON CONFLICT ("papel_id", "area", "acao") DO UPDATE SET "escopo" = 'todos';
DELETE FROM "papel_permissoes" pp USING "papeis" p
 WHERE pp.papel_id = p.id AND p.base = 'colaborador' AND pp.area = 'nr1';
