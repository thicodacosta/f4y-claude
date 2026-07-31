-- Seed do Pipeline Comercial padrão — Fase 1.
--
-- Etapas conforme especificado no pedido original / docs/business-platform:
-- Lead, Contato, Qualificação, Diagnóstico, Proposta, Negociação, Fechamento,
-- depois Ganho/Perdido como colunas fixas (is_ganho/is_perdido).
--
-- Rodar uma vez, depois de `npm run db:migrate` e de aplicar `rls.sql` —
-- mesma forma de aplicação (docker exec / SQL Editor), ver platform/README.md.
-- Idempotente: não duplica se já existir um pipeline "comercial".

insert into public.pipelines (id, tipo, nome)
select gen_random_uuid(), 'comercial', 'Pipeline Comercial'
where not exists (select 1 from public.pipelines where tipo = 'comercial');

with p as (
  select id from public.pipelines where tipo = 'comercial'
)
insert into public.pipeline_etapas (id, pipeline_id, nome, cor, ordem, sla_dias, probabilidade_padrao, is_ganho, is_perdido)
select gen_random_uuid(), p.id, etapa.nome, etapa.cor, etapa.ordem, etapa.sla_dias, etapa.probabilidade, etapa.is_ganho, etapa.is_perdido
from p, (values
  ('Lead',        '#9297A0', 1, 5,  5,   false, false),
  ('Contato',     '#28AAF0', 2, 5,  15,  false, false),
  ('Qualificação','#28AAF0', 3, 7,  30,  false, false),
  ('Diagnóstico', '#5860A9', 4, 7,  40,  false, false),
  ('Proposta',    '#5860A9', 5, 10, 55,  false, false),
  ('Negociação',  '#F5A623', 6, 10, 70,  false, false),
  ('Fechamento',  '#F5A623', 7, 5,  85,  false, false),
  ('Ganho',       '#15A66B', 8, null, 100, true,  false),
  ('Perdido',     '#E5484D', 9, null, 0,   false, true)
) as etapa(nome, cor, ordem, sla_dias, probabilidade, is_ganho, is_perdido)
where not exists (
  select 1 from public.pipeline_etapas pe where pe.pipeline_id = p.id and pe.nome = etapa.nome
);
