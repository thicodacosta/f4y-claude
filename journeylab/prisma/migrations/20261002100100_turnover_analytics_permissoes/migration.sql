-- Permissões padrão das novas áreas nos papéis de sistema já existentes
-- (migração separada: valores novos de enum só podem ser usados após o commit).
-- Admin: tudo. RH: Offboarding e Retenção completos (sem administrar) e People Analytics
-- (visualizar/exportar). Gestor: Retenção da própria equipe. Colaborador: nada.
INSERT INTO "papel_permissoes" ("id", "tenant_id", "papel_id", "area", "acao", "escopo")
SELECT gen_random_uuid(), p."tenant_id", p."id", r.area::"AreaPermissao", r.acao::"Acao", r.escopo::"Escopo"
FROM "papeis" p
JOIN (VALUES
  ('admin_org', 'offboarding', 'visualizar', 'todos'), ('admin_org', 'offboarding', 'criar', 'todos'), ('admin_org', 'offboarding', 'editar', 'todos'),
  ('admin_org', 'offboarding', 'concluir', 'todos'), ('admin_org', 'offboarding', 'exportar', 'todos'), ('admin_org', 'offboarding', 'administrar', 'todos'),
  ('admin_org', 'retencao', 'visualizar', 'todos'), ('admin_org', 'retencao', 'criar', 'todos'), ('admin_org', 'retencao', 'editar', 'todos'),
  ('admin_org', 'retencao', 'concluir', 'todos'), ('admin_org', 'retencao', 'exportar', 'todos'), ('admin_org', 'retencao', 'administrar', 'todos'),
  ('admin_org', 'analytics', 'visualizar', 'todos'), ('admin_org', 'analytics', 'criar', 'todos'), ('admin_org', 'analytics', 'editar', 'todos'),
  ('admin_org', 'analytics', 'concluir', 'todos'), ('admin_org', 'analytics', 'exportar', 'todos'), ('admin_org', 'analytics', 'administrar', 'todos'),
  ('rh', 'offboarding', 'visualizar', 'todos'), ('rh', 'offboarding', 'criar', 'todos'), ('rh', 'offboarding', 'editar', 'todos'),
  ('rh', 'offboarding', 'concluir', 'todos'), ('rh', 'offboarding', 'exportar', 'todos'),
  ('rh', 'retencao', 'visualizar', 'todos'), ('rh', 'retencao', 'criar', 'todos'), ('rh', 'retencao', 'editar', 'todos'),
  ('rh', 'retencao', 'concluir', 'todos'), ('rh', 'retencao', 'exportar', 'todos'),
  ('rh', 'analytics', 'visualizar', 'todos'), ('rh', 'analytics', 'exportar', 'todos'),
  ('gestor', 'retencao', 'visualizar', 'equipe'), ('gestor', 'retencao', 'criar', 'equipe'), ('gestor', 'retencao', 'editar', 'equipe'),
  ('gestor', 'retencao', 'concluir', 'equipe')
) AS r(base, area, acao, escopo) ON r.base = p."base"::text
WHERE p."sistema"
ON CONFLICT ("papel_id", "area", "acao") DO NOTHING;
