# APIs

A maior parte da leitura/escrita passa direto pelo Supabase client (Postgres
+ RLS fazem o controle de acesso) via TanStack Query — não precisa de uma
camada REST própria para CRUD simples. As rotas abaixo (`app/api/*`, Next.js
route handlers ou Server Actions) existem só onde há lógica que não é CRUD
puro: regras de negócio, integração externa, geração por IA, exportação.

## Convenção

- Server Actions para mutações originadas da própria UI (ex.: mover card,
  fechar vaga) — tipadas ponta a ponta, schema Zod compartilhado com o
  formulário.
- Route handlers (`app/api/*`) só para: (a) webhooks de serviços externos,
  (b) exportações que geram arquivo binário (PDF/Excel), (c) endpoints
  chamados por automação assíncrona (Edge Function → route handler interno).

## Domínio: CRM / Pipeline Comercial

| Ação | Tipo | Descrição |
|---|---|---|
| Criar/editar/mover oportunidade | Server Action | Inclui validação de campos obrigatórios por etapa |
| Excluir/reordenar/renomear etapa | Server Action | Só `admin`; migração de cards ao excluir etapa é transacional |
| Registrar atividade/follow-up | Server Action | Grava em `atividades` |
| Exportar pipeline (PDF/Excel) | Route handler | `GET /api/crm/pipeline-comercial/export?formato=pdf` |

## Domínio: ATS / Pipeline de Vagas

| Ação | Tipo | Descrição |
|---|---|---|
| Criar/editar vaga | Server Action | |
| Mover candidato entre etapas da vaga | Server Action | Dispara automação e, se aplicável, notificação ao Portal do Cliente |
| Buscar candidatos (avançada) | Server Action / RPC Postgres | Full-text + filtros combinados — `search_candidatos(filtros jsonb)` como function Postgres para performance |
| Sugerir candidatos para vaga (matching IA) | Route handler | `POST /api/ia/matching` — ver `diferenciais.md` |
| Gerar Job Description | Route handler | `POST /api/ia/gerar-jd` |
| Resumir currículo | Route handler | `POST /api/ia/resumir-curriculo` |
| Score de candidato | Route handler (async, chamado por Edge Function) | `POST /api/ia/score-candidato` |
| Exportar shortlist (PDF, para cliente/relatório executivo) | Route handler | `GET /api/vagas/[id]/shortlist/export` |

## Domínio: Financeiro

| Ação | Tipo |
|---|---|
| Calcular comissão ao fechar oportunidade/vaga | Server Action (chamada pela automação, não manual) |
| Aprovar/pagar comissão | Server Action, só `financeiro`/`admin` |
| Exportar faturamento | Route handler |

## Domínio: Automações

| Ação | Tipo |
|---|---|
| CRUD de regra de automação | Server Action, só `admin` |
| Executor de automação | Edge Function (`pg_cron` ou trigger de banco → function → chama route handler interno) |
| Log de execução | Consulta direta à tabela `automacao_execucoes` |

## Domínio: Dashboards/Relatórios

| Ação | Tipo |
|---|---|
| Salvar layout de dashboard | Server Action |
| Exportar dashboard (PDF/Excel) | Route handler, `GET /api/relatorios/[dashboard]/export` |

## Integrações externas (webhooks/callbacks recebidos)

| Endpoint | Origem |
|---|---|
| `POST /api/webhooks/whatsapp` | WhatsApp Business API — mensagens recebidas viram `atividades` |
| `POST /api/webhooks/calendar` | Google Calendar/Microsoft 365 — confirmação de reunião/entrevista |
| `POST /api/webhooks/linkedin` | Import de candidato via LinkedIn Recruiter |
| `POST /api/auth/callback` | Supabase Auth (SSO Google/Microsoft) |

## IA — contratos de request/response (alto nível)

```
POST /api/ia/gerar-jd
  in:  { cargo, senioridade, stack, modelo_trabalho, empresa_id }
  out: { job_description: string, skills_sugeridas: string[] }

POST /api/ia/resumir-curriculo
  in:  { candidato_id }
  out: { resumo: string, modelo: string, gerado_em: timestamptz }

POST /api/ia/score-candidato
  in:  { candidato_id, vaga_id? }
  out: { score: number, fatores: { tecnico: number, comportamental: number, aderencia_stack: number } }

POST /api/ia/matching
  in:  { vaga_id }
  out: { candidatos: [{ candidato_id, score, justificativa }] }
```

Toda resposta de IA é persistida (não é só exibida e descartada) para
permitir auditoria e re-treino/ajuste de prompt no futuro — ver exigência de
trilha em `modelagem-dados.md`.
