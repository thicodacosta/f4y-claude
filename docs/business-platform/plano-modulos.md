# Plano de Desenvolvimento por Módulo

Cada fase entrega algo utilizável em produção — nunca uma fase inteira de
"infra sem valor visível". Fase só começa depois de aprovação da anterior,
conforme item 13 do pedido original.

## Fase 0 — Fundação
- Setup Next.js + Supabase + Prisma + Design System (tokens, mesmo que
  provisórios) + Auth + shell da aplicação (sidebar, topbar, dark mode).
- Papéis e RLS básicos (`arquitetura.md`).
- Sem tela de negócio ainda — critério de pronto: login funciona, shell
  renderiza, papel do usuário controla o que aparece no menu.

## Fase 1 — CRM: Pipeline Comercial
- Entidades `empresas`, `contatos`, `oportunidades`, `pipelines`,
  `pipeline_etapas`.
- Kanban arrastável com etapas editáveis (admin).
- Views Lista e Tabela (Calendário/Timeline podem esperar a Fase 1.1 se o
  prazo apertar — Kanban é o valor central).
- Painel de card com Atividades, Arquivos, Histórico.
- Filtros do pipeline.
- **Critério de pronto:** um consultor comercial consegue abandonar a
  planilha atual e rodar o pipeline real inteiro aqui.

## Fase 2 — ATS: Pipeline de Vagas + Candidatos
- Entidades `vagas`, `candidatos`, `vaga_candidatos`.
- Kanban de vagas + Kanban interno de candidatos por vaga.
- Tela completa da vaga (`wireframes.md#3-1`).
- Perfil de candidato + busca avançada.
- Vínculo oportunidade Ganha → vaga (fluxo 1 de `fluxos-usuario.md`).
- **Critério de pronto:** um recrutador roda o processo inteiro de uma vaga
  do zero ao fechamento sem sair da plataforma.

## Fase 3 — Dashboard e Forecast
- Todos os KPIs e gráficos de `wireframes.md#1`.
- Módulo de Forecast completo.
- Dashboards separados por área (Comercial, Financeiro, Recrutamento,
  Diretoria, Consultores, Clientes) com widgets arrastáveis e export.
- **Critério de pronto:** diretoria substitui a apresentação manual mensal
  pelo dashboard ao vivo.

## Fase 4 — Financeiro
- `comissoes`, `faturamento`, receita recorrente.
- Cálculo automático de comissão ao fechar oportunidade/vaga.
- **Critério de pronto:** financeiro fecha o mês sem planilha paralela.

## Fase 5 — Automações
- Engine de regras (`automacoes`/`automacao_execucoes`).
- Ações: criar tarefa, notificar, mover card, enviar e-mail/WhatsApp,
  atualizar forecast.
- **Critério de pronto:** pelo menos 3 automações do dia a dia real rodando
  (ex.: lembrete de renovação de alocação, notificação de SLA estourado,
  criação automática de vaga a partir de oportunidade Ganha).

## Fase 6 — Verticais especializadas
- Alocação Tech: pool de talentos, `contratos_alocacao`, lembrete de
  renovação.
- Executive Search: confidencialidade, mapeamento de mercado, relatório de
  posição exportável.
- **Critério de pronto:** as duas skills (`alocacao-tech`,
  `executive-search`) têm contrapartida real na plataforma, não só processo
  manual.

## Fase 7 — Portais externos
- Portal do Cliente (somente leitura + aprovação de shortlist).
- Portal do Candidato (status do processo, edição de perfil com revisão).
- **Critério de pronto:** ao menos um cliente real usando o portal em vez de
  update por e-mail.

## Fase 8 — IA
- Geração de JD, resumo de currículo, score de candidato, matching.
- Detecção de gargalo de pipeline, alertas executivos.
- **Critério de pronto:** recrutador usa sugestão de matching em vagas reais
  e confia o suficiente para não ignorá-la sistematicamente.

## Fase 9 — Integrações
- LinkedIn Recruiter, WhatsApp Business, Google Calendar/Microsoft 365,
  Zoom/Teams, Slack.
- Cada integração entra isolada — nenhuma bloqueia as outras.

## Fase 10 — Polimento e diferenciais avançados
- Gamificação/metas, timeline unificada cross-entidade, painel de
  produtividade — ver `diferenciais.md` para a lista completa, priorizada em
  `backlog-moscow.md`.

Dependência entre fases: 0 bloqueia tudo; 1 e 2 são paralelizáveis entre si
depois da Fase 0 mas competem pelo mesmo time — decisão de ordem real
(Comercial primeiro ou ATS primeiro) é de negócio, não técnica; ver
`roadmap.md`.
