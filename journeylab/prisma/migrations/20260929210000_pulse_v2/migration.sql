-- Pulse v2: 16 tipos de pergunta, audiência, pesquisas identificadas, convites por e-mail,
-- templates globais/da empresa, insights de IA e marca da organização. Preserva os dados.

-- Marca da organização (e-mails white-label).
ALTER TABLE "organizacoes" ADD COLUMN "cor_marca" TEXT, ADD COLUMN "logo_url" TEXT;

-- Perguntas: enum antigo → tipos novos (texto) + configuração por tipo.
ALTER TABLE "perguntas_pulse" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}', ADD COLUMN "tipo_novo" TEXT;
UPDATE "perguntas_pulse" SET "tipo_novo" = CASE "tipo"::text
  WHEN 'escala' THEN 'likert' WHEN 'enps' THEN 'nps' WHEN 'sim_nao' THEN 'boolean' ELSE 'long_text' END;
UPDATE "perguntas_pulse" SET "config" = '{"scaleMin":1,"scaleMax":5}' WHERE "tipo_novo" = 'likert';
UPDATE "perguntas_pulse" SET "config" = '{"scaleMin":0,"scaleMax":10,"scaleMinLabel":"Nada provável","scaleMaxLabel":"Muito provável"}' WHERE "tipo_novo" = 'nps';
ALTER TABLE "perguntas_pulse" DROP COLUMN "tipo";
ALTER TABLE "perguntas_pulse" RENAME COLUMN "tipo_novo" TO "tipo";
ALTER TABLE "perguntas_pulse" ALTER COLUMN "tipo" SET NOT NULL;
DROP TYPE "TipoPergunta";

-- Pesquisas: audiência e novas configurações.
ALTER TABLE "pesquisas_pulse"
  ADD COLUMN "ai_insights" JSONB,
  ADD COLUMN "ai_insights_em" TIMESTAMP(3),
  ADD COLUMN "anonima" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "area_ids" UUID[],
  ADD COLUMN "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "audiencia_tipo" TEXT NOT NULL DEFAULT 'todos',
  ADD COLUMN "colaborador_ids" UUID[],
  ADD COLUMN "data_inicio" DATE,
  ADD COLUMN "link_aberto" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "modelo_id" UUID,
  ADD COLUMN "modelo_slug" TEXT,
  ADD COLUMN "publico_total" INTEGER NOT NULL DEFAULT 0;
UPDATE "pesquisas_pulse" SET "audiencia_tipo" = CASE WHEN "publico_todos" THEN 'todos' ELSE 'equipes' END;
UPDATE "pesquisas_pulse" SET "data_inicio" = "aberta_em"::date WHERE "aberta_em" IS NOT NULL;
ALTER TABLE "pesquisas_pulse" DROP COLUMN "publico_todos";
ALTER TABLE "pesquisas_pulse" ADD CONSTRAINT "pesquisas_audiencia_valida" CHECK ("audiencia_tipo" IN ('todos', 'departamentos', 'equipes', 'colaboradores'));
ALTER TABLE "pesquisas_pulse" ADD CONSTRAINT "pesquisas_link_aberto_anonima" CHECK (NOT "link_aberto" OR "anonima");

-- Respostas atômicas: opção, linha de matriz, departamento, pessoa (só identificadas).
ALTER TABLE "respostas_pulse" ADD COLUMN "area_id" UUID, ADD COLUMN "colaborador_id" UUID, ADD COLUMN "linha" INTEGER, ADD COLUMN "opcao" TEXT;
UPDATE "respostas_pulse" r SET "area_id" = e."area_id" FROM "equipes" e WHERE e."id" = r."equipe_id";

-- Convites (link pessoal derivado por HMAC — nenhum token gravado).
CREATE TABLE "convites_pulse" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "pesquisa_id" UUID NOT NULL,
  "colaborador_id" UUID NOT NULL,
  "enviado_em" TIMESTAMP(3),
  "lembrete_em" TIMESTAMP(3),
  "erro" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "convites_pulse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "convites_pulse_pesquisa_id_colaborador_id_key" ON "convites_pulse"("pesquisa_id", "colaborador_id");
ALTER TABLE "convites_pulse" ADD CONSTRAINT "convites_pulse_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas_pulse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Templates globais (tenant nulo) e da empresa.
CREATE TABLE "modelos_pulse" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "nome" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "descricao" TEXT,
  "icone" TEXT,
  "cor" TEXT,
  "perguntas" JSONB NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "modelos_pulse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "modelos_pulse_tenant_id_idx" ON "modelos_pulse"("tenant_id");
ALTER TABLE "pesquisas_pulse" ADD CONSTRAINT "pesquisas_pulse_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos_pulse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permissões: gestor lê os resultados da empresa (somente leitura).
UPDATE "papel_permissoes" pp SET "escopo" = 'todos' FROM "papeis" p
 WHERE pp.papel_id = p.id AND p.base = 'gestor' AND pp.area = 'pulse' AND pp.acao = 'visualizar';
