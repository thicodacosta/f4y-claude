-- Pulse: RH/Recrutador passa a exportar os resultados agregados (acesso completo ao módulo).
INSERT INTO "papel_permissoes" ("id", "tenant_id", "papel_id", "area", "acao", "escopo")
SELECT gen_random_uuid(), p.tenant_id, p.id, 'pulse', 'exportar', 'todos'
  FROM "papeis" p
 WHERE p.base = 'rh'
   AND EXISTS (SELECT 1 FROM "papel_permissoes" x WHERE x.papel_id = p.id AND x.area = 'pulse' AND x.acao = 'criar')
ON CONFLICT ("papel_id", "area", "acao") DO NOTHING;
