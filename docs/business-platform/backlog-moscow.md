# Backlog Priorizado (MoSCoW)

Organizado por módulo, não por fase — cruze com `plano-modulos.md` para saber
quando cada item entra.

## Must Have

- Autenticação + papéis + RLS básicos
- Pipeline Comercial: Kanban, etapas editáveis, CRUD de oportunidade
- Pipeline de Vagas: Kanban, CRUD de vaga, Kanban interno de candidatos
- Perfil de candidato completo (campos do pedido original)
- Busca avançada de candidatos (skill, cargo, cidade, tecnologia, etc.)
- Timeline/histórico por entidade (oportunidade, vaga, candidato, empresa)
- Dashboard principal com os KPIs e gráficos centrais (receita, pipeline,
  forecast, conversão)
- Forecast (receita prevista/confirmada/perdida, pipeline coverage)
- Filtros globais (mês, ano, consultor, empresa, origem, serviço, status,
  segmento, responsável, valor)
- Cálculo de comissão ao fechar oportunidade/vaga
- Vínculo automático oportunidade Ganha → vaga
- Views Lista e Tabela nos dois pipelines
- Dark mode
- Exportação PDF/Excel de dashboards e relatórios

## Should Have

- Views Calendário e Timeline nos dois pipelines
- Engine de automações (mover card, notificar, criar tarefa)
- Contratos de Alocação Tech + lembrete automático de renovação
- Confidencialidade de vaga (Executive Search)
- Mapeamento de mercado (Executive Search)
- Dashboards separados por área com widgets arrastáveis e salvos
- Command palette (`Cmd/Ctrl+K`)
- Notificações realtime
- Geração de Job Description por IA
- Resumo de currículo por IA

## Could Have

- Score automático de candidato por IA
- Matching inteligente candidato↔vaga por IA
- Detecção de gargalo de pipeline (alertas automáticos)
- Portal do Cliente
- Portal do Candidato
- Integração LinkedIn Recruiter
- Integração WhatsApp Business
- Integração Google Calendar/Microsoft 365
- Integração Zoom/Teams
- Integração Slack
- Painel de produtividade por consultor/recrutador
- Heatmap de atividade no dashboard
- Módulo de metas e gamificação

## Won't Have (nesta rodada)

- Multi-tenancy / white-label para outras consultorias (ver assunção em
  `README.md` — só entra se a estratégia de negócio mudar explicitamente)
- Integração contábil/fiscal automatizada (emissão de nota fiscal)
- App mobile nativo (responsivo web cobre o caso de uso por ora)
- Marketplace público de vagas
