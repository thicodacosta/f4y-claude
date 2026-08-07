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

-- Seed do Pipeline de Vagas padrão — Fase 2.
-- Etapas conforme o pedido original (ATS): Abertas, Análise RH, CV Enviado,
-- Entrevista Cliente, Forecast, depois Fechada/Perdida como colunas fixas.
-- Este é o Kanban *externo* (move a vaga inteira) — o Kanban interno por
-- candidato usa o enum EtapaVagaCandidato, fixo, não esta tabela.

insert into public.pipelines (id, tipo, nome)
select gen_random_uuid(), 'vagas', 'Pipeline de Vagas'
where not exists (select 1 from public.pipelines where tipo = 'vagas');

with p as (
  select id from public.pipelines where tipo = 'vagas'
)
insert into public.pipeline_etapas (id, pipeline_id, nome, cor, ordem, sla_dias, probabilidade_padrao, is_ganho, is_perdido)
select gen_random_uuid(), p.id, etapa.nome, etapa.cor, etapa.ordem, etapa.sla_dias, etapa.probabilidade, etapa.is_ganho, etapa.is_perdido
from p, (values
  ('Abertas',            '#9297A0', 1, 3,  10,  false, false),
  ('Análise RH',         '#28AAF0', 2, 5,  25,  false, false),
  ('CV Enviado',         '#28AAF0', 3, 7,  45,  false, false),
  ('Entrevista Cliente', '#5860A9', 4, 10, 65,  false, false),
  ('Forecast',           '#F5A623', 5, 10, 85,  false, false),
  ('Fechada',            '#15A66B', 6, null, 100, true,  false),
  ('Perdida',            '#E5484D', 7, null, 0,   false, true)
) as etapa(nome, cor, ordem, sla_dias, probabilidade, is_ganho, is_perdido)
where not exists (
  select 1 from public.pipeline_etapas pe where pe.pipeline_id = p.id and pe.nome = etapa.nome
);

-- Seed de regras de comissão padrão — Fase 4.
-- Percentuais placeholder (10%/8%) para o sistema não calcular 0% até um
-- admin ajustar em /financeiro (aba Regras) — não são a política real de
-- remuneração da Find4You, só um valor de partida sensato para dev/demo.
--
-- `atualizado_em` vai explícito (now()) em vez de depender de um DEFAULT no
-- banco: um DEFAULT adicionado só via ALTER TABLE (fora do schema.prisma)
-- já foi derrubado sem querer por um `prisma migrate dev` seguinte, que
-- resolve a tabela de volta pro que o schema.prisma declara (sem default,
-- já que @updatedAt não gera um) — ver histórico de migrations
-- *_atualizado_em_default. Setar aqui é robusto contra isso.
insert into public.regras_comissao (id, vertical, percentual_consultor, percentual_recrutador, atualizado_em)
select gen_random_uuid(), v.vertical::"VerticalNegocio", 10.00, 8.00, now()
from (values ('tecnologia'), ('corporativo'), ('executive_search'), ('alocacao_tech')) as v(vertical)
where not exists (
  select 1 from public.regras_comissao rc where rc.vertical = v.vertical::"VerticalNegocio"
);

-- Seed das 3 automações do critério de pronto da Fase 5 (plano-modulos.md).
-- As duas de "entrou_etapa" apontam pra etapa fixa do pipeline seedado acima
-- — se o nome da etapa mudar via /configuracoes/pipelines, a automação para
-- de disparar (fica visível como "sem etapa" em /configuracoes/automacoes,
-- é reatribuível por lá).
insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Notificar SLA estourado',
  null,
  'vencimento_sla'::"EventoAutomacao",
  '{"tipo": "notificar", "params": {"titulo": "SLA estourado"}}'::jsonb,
  now()
where not exists (select 1 from public.automacoes where nome = 'Notificar SLA estourado');

insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Oportunidade Ganha → tarefa de confirmação',
  pe.id,
  'entrou_etapa'::"EventoAutomacao",
  '{"tipo": "criar_tarefa", "params": {"titulo": "Confirmar valor final e enviar contrato", "prazoDias": 2}}'::jsonb,
  now()
from public.pipeline_etapas pe
join public.pipelines p on p.id = pe.pipeline_id
where p.tipo = 'comercial' and pe.nome = 'Ganho'
  and not exists (select 1 from public.automacoes where nome = 'Oportunidade Ganha → tarefa de confirmação');

insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Vaga aberta → tarefa de sourcing',
  pe.id,
  'entrou_etapa'::"EventoAutomacao",
  '{"tipo": "criar_tarefa", "params": {"titulo": "Iniciar sourcing de candidatos", "prazoDias": 1}}'::jsonb,
  now()
from public.pipeline_etapas pe
join public.pipelines p on p.id = pe.pipeline_id
where p.tipo = 'vagas' and pe.nome = 'Abertas'
  and not exists (select 1 from public.automacoes where nome = 'Vaga aberta → tarefa de sourcing');

-- Fase 6 — lembrete de renovação de contrato de Alocação Tech.
insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Lembrete de renovação de contrato',
  null,
  'renovacao_contrato'::"EventoAutomacao",
  '{"tipo": "notificar", "params": {"titulo": "Contrato de alocação vencendo em breve"}}'::jsonb,
  now()
where not exists (select 1 from public.automacoes where nome = 'Lembrete de renovação de contrato');
