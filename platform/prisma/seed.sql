-- Seed do Pipeline Comercial padrão — Fase 1, redefinido na Fase 13
-- (reestruturação completa do Pipeline Comercial, ver
-- git log "Redefinir Pipeline Comercial").
--
-- Etapas: Lead, Contato, Reunião, Proposta, Negociação, depois
-- Homologado/Perdido como colunas fixas (is_ganho/is_perdido). Em produção
-- essas etapas já existiam com nomes antigos (Qualificação/Diagnóstico/
-- Fechamento/Ganho) — a migração renomeou/consolidou as linhas em vez de
-- recriar, pra preservar os IDs referenciados por Automacao. Este INSERT só
-- roda em ambiente novo (idempotente via not exists).
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
  ('Lead',        '#9297A0', 1, 5,  10,  false, false),
  ('Contato',     '#28AAF0', 2, 5,  20,  false, false),
  ('Reunião',     '#28AAF0', 3, 7,  40,  false, false),
  ('Proposta',    '#5860A9', 4, 10, 60,  false, false),
  ('Negociação',  '#F5A623', 5, 10, 80,  false, false),
  ('Homologado',  '#15A66B', 6, null, 100, true,  false),
  ('Perdido',     '#E5484D', 7, null, 0,   false, true)
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
insert into public.pipeline_etapas (id, pipeline_id, nome, cor, ordem, sla_dias, probabilidade_padrao, is_ganho, is_perdido, is_pausada)
select gen_random_uuid(), p.id, etapa.nome, etapa.cor, etapa.ordem, etapa.sla_dias, etapa.probabilidade, etapa.is_ganho, etapa.is_perdido, etapa.is_pausada
from p, (values
  ('Abertas',            '#9297A0', 1, 3,  10,  false, false, false),
  ('Análise RH',         '#28AAF0', 2, 5,  25,  false, false, false),
  ('CV Enviado',         '#28AAF0', 3, 7,  45,  false, false, false),
  ('Entrevista Cliente', '#5860A9', 4, 10, 65,  false, false, false),
  ('Forecast',           '#F5A623', 5, 10, 85,  false, false, false),
  ('Fechada',            '#15A66B', 6, null, 100, true,  false, false),
  ('Perdida',            '#E5484D', 7, null, 0,   false, true,  false),
  ('Stand By',           '#EAB308', 8, null, 30,  false, false, true)
) as etapa(nome, cor, ordem, sla_dias, probabilidade, is_ganho, is_perdido, is_pausada)
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
where p.tipo = 'comercial' and pe.nome = 'Homologado'
  and not exists (select 1 from public.automacoes where nome = 'Oportunidade Ganha → tarefa de confirmação');

-- Fase 13 — automações adicionais do Pipeline Comercial reestruturado
-- (seção 17 do pedido: "automações estruturadas" por transição de etapa).
insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Reunião agendada → preparar proposta',
  pe.id,
  'entrou_etapa'::"EventoAutomacao",
  '{"tipo": "criar_tarefa", "params": {"titulo": "Registrar resultado da reunião e preparar proposta", "prazoDias": 2}}'::jsonb,
  now()
from public.pipeline_etapas pe
join public.pipelines p on p.id = pe.pipeline_id
where p.tipo = 'comercial' and pe.nome = 'Reunião'
  and not exists (select 1 from public.automacoes where nome = 'Reunião agendada → preparar proposta');

insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Proposta enviada → follow-up',
  pe.id,
  'entrou_etapa'::"EventoAutomacao",
  '{"tipo": "criar_tarefa", "params": {"titulo": "Fazer follow-up da proposta enviada", "prazoDias": 3}}'::jsonb,
  now()
from public.pipeline_etapas pe
join public.pipelines p on p.id = pe.pipeline_id
where p.tipo = 'comercial' and pe.nome = 'Proposta'
  and not exists (select 1 from public.automacoes where nome = 'Proposta enviada → follow-up');

insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Em negociação → alinhar condições',
  pe.id,
  'entrou_etapa'::"EventoAutomacao",
  '{"tipo": "criar_tarefa", "params": {"titulo": "Alinhar condições finais e objeções da negociação", "prazoDias": 2}}'::jsonb,
  now()
from public.pipeline_etapas pe
join public.pipelines p on p.id = pe.pipeline_id
where p.tipo = 'comercial' and pe.nome = 'Negociação'
  and not exists (select 1 from public.automacoes where nome = 'Em negociação → alinhar condições');

insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Homologado → iniciar onboarding do cliente',
  pe.id,
  'entrou_etapa'::"EventoAutomacao",
  '{"tipo": "criar_tarefa", "params": {"titulo": "Iniciar onboarding do cliente", "prazoDias": 5}}'::jsonb,
  now()
from public.pipeline_etapas pe
join public.pipelines p on p.id = pe.pipeline_id
where p.tipo = 'comercial' and pe.nome = 'Homologado'
  and not exists (select 1 from public.automacoes where nome = 'Homologado → iniciar onboarding do cliente');

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

-- Fase 11 — alertas do pop-up de fechamento de vaga (ver modules/financeiro/alertas.ts).
insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'NF pendente de emissão',
  null,
  'nf_pendente'::"EventoAutomacao",
  '{"tipo": "notificar", "params": {"titulo": "NF pendente de emissão"}}'::jsonb,
  now()
where not exists (select 1 from public.automacoes where nome = 'NF pendente de emissão');

insert into public.automacoes (id, nome, pipeline_etapa_id, evento, acao, atualizado_em)
select gen_random_uuid(),
  'Alocação chegando ao fim',
  null,
  'vencimento_alocacao'::"EventoAutomacao",
  '{"tipo": "notificar", "params": {"titulo": "Alocação chegando ao fim"}}'::jsonb,
  now()
where not exists (select 1 from public.automacoes where nome = 'Alocação chegando ao fim');
