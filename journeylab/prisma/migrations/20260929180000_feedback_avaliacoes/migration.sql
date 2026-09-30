-- Feedback 1:1 avaliado (16 critérios) + agendamento com duração, recorrência e vínculo.
-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('mensal', 'bimestral', 'trimestral', 'manual');
-- CreateEnum
CREATE TYPE "Semaforo" AS ENUM ('verde', 'amarelo', 'vermelho');
-- AlterTable
ALTER TABLE "reunioes" ADD COLUMN     "avaliacao_id" UUID,
ADD COLUMN     "criado_por_id" UUID,
ADD COLUMN     "duracao_min" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "serie_id" UUID;
-- CreateTable
CREATE TABLE "avaliacoes_feedback" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "gestor_id" UUID,
    "data" DATE NOT NULL,
    "periodicidade" "Periodicidade" NOT NULL DEFAULT 'mensal',
    "p_produtividade" SMALLINT NOT NULL,
    "p_qualidade" SMALLINT NOT NULL,
    "p_ferramentas" SMALLINT NOT NULL,
    "p_priorizacao" SMALLINT NOT NULL,
    "p_tempo" SMALLINT NOT NULL,
    "p_aprendizado" SMALLINT NOT NULL,
    "p_relacionamento" SMALLINT NOT NULL,
    "p_comunicacao" SMALLINT NOT NULL,
    "c_criatividade" SMALLINT NOT NULL,
    "c_confianca" SMALLINT NOT NULL,
    "c_resultado" SMALLINT NOT NULL,
    "c_senso_dono" SMALLINT NOT NULL,
    "c_adaptabilidade" SMALLINT NOT NULL,
    "c_resiliencia" SMALLINT NOT NULL,
    "c_longo_prazo" SMALLINT NOT NULL,
    "c_colaboracao" SMALLINT NOT NULL,
    "media_performance" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "media_cultura" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "media_geral" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "semaforo" "Semaforo" NOT NULL DEFAULT 'vermelho',
    "observacoes" TEXT,
    "autor_id" UUID NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avaliacoes_feedback_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "avaliacoes_feedback_tenant_id_data_idx" ON "avaliacoes_feedback"("tenant_id", "data");
-- CreateIndex
CREATE INDEX "avaliacoes_feedback_tenant_id_colaborador_id_data_idx" ON "avaliacoes_feedback"("tenant_id", "colaborador_id", "data");
-- AddForeignKey
ALTER TABLE "reunioes" ADD CONSTRAINT "reunioes_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "avaliacoes_feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "avaliacoes_feedback" ADD CONSTRAINT "avaliacoes_feedback_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "avaliacoes_feedback" ADD CONSTRAINT "avaliacoes_feedback_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notas obrigatórias de 1 a 5 (validação no banco, além do servidor).
ALTER TABLE "avaliacoes_feedback" ADD CONSTRAINT "avaliacoes_notas_1_a_5" CHECK (
  "p_produtividade" BETWEEN 1 AND 5 AND "p_qualidade" BETWEEN 1 AND 5 AND "p_ferramentas" BETWEEN 1 AND 5 AND "p_priorizacao" BETWEEN 1 AND 5 AND
  "p_tempo" BETWEEN 1 AND 5 AND "p_aprendizado" BETWEEN 1 AND 5 AND "p_relacionamento" BETWEEN 1 AND 5 AND "p_comunicacao" BETWEEN 1 AND 5 AND
  "c_criatividade" BETWEEN 1 AND 5 AND "c_confianca" BETWEEN 1 AND 5 AND "c_resultado" BETWEEN 1 AND 5 AND "c_senso_dono" BETWEEN 1 AND 5 AND
  "c_adaptabilidade" BETWEEN 1 AND 5 AND "c_resiliencia" BETWEEN 1 AND 5 AND "c_longo_prazo" BETWEEN 1 AND 5 AND "c_colaboracao" BETWEEN 1 AND 5
);
ALTER TABLE "reunioes" ADD CONSTRAINT "reunioes_duracao_valida" CHECK ("duracao_min" IN (15, 30, 45, 60, 90));

-- Papéis padrão existentes: RH e Administração registram e administram feedbacks;
-- colaborador não acessa o módulo nesta versão.
INSERT INTO "papel_permissoes" ("id", "tenant_id", "papel_id", "area", "acao", "escopo")
SELECT gen_random_uuid(), p.tenant_id, p.id, 'feedback', a.acao::"Acao", 'todos'
FROM "papeis" p
CROSS JOIN (VALUES ('visualizar'), ('criar'), ('editar'), ('concluir'), ('exportar')) AS a(acao)
WHERE p.base IN ('admin_org', 'rh')
ON CONFLICT ("papel_id", "area", "acao") DO UPDATE SET "escopo" = 'todos';
DELETE FROM "papel_permissoes" pp USING "papeis" p
 WHERE pp.papel_id = p.id AND p.base = 'colaborador' AND pp.area = 'feedback';
