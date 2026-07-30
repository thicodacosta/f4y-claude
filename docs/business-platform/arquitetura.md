# Arquitetura — Find4You Business Platform

## Princípio geral

Uma única aplicação modular (não microsserviços) — o domínio é pequeno o
suficiente (uma consultoria, não uma multinacional) para que separação de
serviços custe mais em complexidade operacional do que resolve. Modularidade
vem de fronteiras claras dentro do monólito (por domínio: CRM, ATS,
Financeiro, Automação), não de deploys independentes.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript | SSR/streaming para dashboards pesados, rotas server-first, mesmo runtime para app e portais |
| Estilo | Tailwind CSS + shadcn/ui | Consistência com `design-system/`; shadcn dá primitives acessíveis (Radix) sem lock-in visual — tokens do Design System sobrescrevem o tema padrão |
| Estado servidor | TanStack Query | Cache, invalidação e otimistic update para listas/kanban que mudam com frequência |
| Formulários | React Hook Form + Zod | Validação compartilhada client/server (mesmo schema Zod valida no client e na Server Action/API) |
| Animação | Framer Motion | Micro-interações (drag, transições de painel, toasts) — nunca decorativa a ponto de atrapalhar performance |
| Gráficos | Recharts | Dashboards, funis, forecast |
| Drag & drop | dnd-kit | Kanban (Pipeline Comercial e Pipeline de Vagas), reordenação de etapas |
| Banco de dados | PostgreSQL via Supabase | Já é o padrão do pedido; RLS nativo resolve controle de acesso por papel sem camada extra |
| ORM | Prisma | Migrations versionadas e schema tipado; Prisma para escrita/migração, `supabase-js` client para leitura realtime e Storage |
| Auth | Supabase Auth | Login por e-mail/senha + SSO (Google Workspace/Microsoft 365, ver `docs/business-platform/apis.md`) |
| Realtime | Supabase Realtime | Atualização ao vivo de kanban, notificações, presença ("quem está vendo este card") |
| Storage | Supabase Storage | Currículos, anexos de vaga/oportunidade, exports |
| Filas/jobs | Supabase Edge Functions + `pg_cron` | Automações (mover card, enviar e-mail, recalcular forecast), scoring de IA assíncrono |
| IA | Claude via API (Anthropic) | Scoring de candidato, resumo de currículo, geração de JD, matching — ver `diferenciais.md` |

## Camadas dentro do monólito

```
app/                    # Next.js App Router — rotas por módulo (ver mapa-navegacao.md)
  (app)/                # área autenticada interna (consultores, recrutadores, diretoria)
  (portal-cliente)/     # área restrita do cliente
  (portal-candidato)/   # área restrita do candidato
  api/                  # route handlers (webhooks externos, exports)
modules/                # lógica de domínio, isolada por bounded context
  crm/                  # pipeline comercial, oportunidades, atividades
  ats/                  # pipeline de vagas, candidatos, matching
  financeiro/           # faturamento, comissões, receita recorrente
  automacoes/           # engine de regras/triggers
  ia/                    # clientes de IA (scoring, resumo, JD, matching) — camada fina sobre a API da Anthropic
  shared/               # tipos, utils, componentes de app (não visuais — esses vêm do Design System)
prisma/                 # schema.prisma, migrations
```

Cada módulo de domínio expõe seus próprios *server actions*/serviços; a UI
nunca acessa o banco diretamente — sempre através da camada de módulo, mesmo
quando o dado vem via Supabase client no browser (RLS é a rede de segurança,
não a única barreira).

## Multi-tenancy e controle de acesso

**[ASSUNÇÃO — confirmar antes da Fase 1]** Aplicação single-tenant: um único
banco para a Find4You, sem `organization_id`. RLS é usada para **papel e
visibilidade**, não para isolar clientes entre si como em um SaaS
multi-tenant. Papéis previstos:

| Papel | Visibilidade |
|---|---|
| `admin` | Acesso total, inclui configuração de pipelines/automações |
| `diretoria` | Leitura total + dashboards executivos; edição restrita |
| `consultor_comercial` | Oportunidades próprias + compartilhadas por time; leitura de clientes |
| `recrutador` | Vagas e candidatos atribuídos; leitura de vagas do time |
| `consultor_executive_search` | Mesma base do recrutador, com campos confidenciais extras (ver `docs/servicos/executive-search.md` para o porquê da confidencialidade) |
| `financeiro` | Módulo financeiro completo; leitura do restante |
| `cliente_portal` | Somente as vagas/oportunidades da própria empresa, somente leitura + comentário |
| `candidato_portal` | Somente o próprio processo seletivo, somente leitura |

RLS policies em Postgres aplicam essa tabela linha a linha (ex.: policy em
`vagas` filtra por `cliente_id = auth.jwt() -> cliente_id` quando o papel é
`cliente_portal`). Prisma faz as migrations; as policies em si vivem em SQL
versionado (`prisma/migrations/*/rls.sql`), não no schema Prisma (Prisma não
modela RLS nativamente).

## Integrações externas (contratos, não implementação)

| Integração | Uso |
|---|---|
| LinkedIn Recruiter | Import de perfil de candidato, sourcing |
| WhatsApp Business API | Timeline unificada, automações de mensagem |
| Google Calendar / Microsoft 365 | Agenda, convites de entrevista/reunião |
| Zoom / Teams | Links de entrevista automáticos a partir da agenda |
| Slack | Notificações de automação (ex.: vaga fechada, oportunidade movida) |
| Anthropic API (Claude) | Scoring, resumo de currículo, geração de JD, matching |

Nenhuma dessas integrações é pré-condição da Fase 1 — ver `plano-modulos.md`
para quando cada uma entra. `automations/` na raiz do workspace continua
sendo o lugar de scripts/config de integração já operacionais fora da
plataforma (ex.: Instagram); quando uma integração migrar para dentro do
Business Platform, o código sai de `automations/<nome>/` e passa a viver em
`platform/modules/automacoes/`.

## Ambientes e deploy

[TODO] Definir com Thiago — hospedagem (Vercel é o par natural do Next.js;
Supabase já resolve banco/auth/storage/realtime gerenciados), estratégia de
staging vs. produção, e processo de CI/CD. Nenhuma decisão de infra deve ser
tomada silenciosamente aqui porque tem custo recorrente associado.

## Observabilidade

Erros (ex. Sentry), analytics de produto (ex. PostHog) e logs de automação
(auditoria de "o que a engine de regras fez e por quê") são requisito desde a
Fase 1 do ATS/CRM, não um adicional posterior — um sistema que move dados de
cliente e comissão sem trilha de auditoria é uma falha de produto, não um
detalhe técnico.
