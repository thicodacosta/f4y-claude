# JourneyLab — aplicação multitenant

Aplicação autenticada dos produtos JourneyLab (CRM de Candidatos, Onboarding,
Feedback 1:1, Pulse, PDI, Diagnóstico NR-1). Arquitetura, modelo de dados,
isolamento e permissões: [`docs/journeylab/arquitetura.md`](../docs/journeylab/arquitetura.md).
O site comercial é outro projeto (Claude Design).

## Status

| Etapa | Situação |
|---|---|
| 1. Base multitenant (auth, convites, organizações, troca de organização, papéis e permissões configuráveis, módulos/entitlements com histórico, cadastro compartilhado, painel, auditoria, administração JourneyLab, suporte temporário) | **Funcional e testada** |
| 2. CRM de Candidatos (cadastro, duplicidade, currículo/anexos em storage privado, tags, histórico, vagas, candidaturas, exportação CSV auditada, conversão em colaborador) | **Funcional e testada** |
| 3. Onboarding (modelos com etapas/tarefas/documentos/materiais, início manual ou pela conversão do CRM, boas-vindas, tarefas por responsável com prazo e atraso, checklist de documentação, progresso, conclusão/cancelamento, histórico) | **Funcional e testada** |
| 4. Feedback 1:1 (agenda, pautas-modelo, anotações compartilhadas/privadas com regra no banco, compromissos, 1:1 → PDI) | **Funcional e testada** |
| 5. PDI (rascunho → ativo → concluído/arquivado, objetivos, ações com evidência, revisões e comentários, integração com compromissos) | **Funcional e testada** |
| 6. Pulse (modelos, público por equipe, respostas anônimas, resultados só agregados após encerramento, mínimo de respondentes e regra do complemento no banco) | **Funcional e testada** |
| 7. Diagnóstico NR-1 (questionário de referência editável, participação anônima, índices por dimensão, riscos, plano de ação, relatório CSV auditado) | **Funcional e testada** |
| 8. Painel integrado, jornada da pessoa entre módulos, exportações com permissão, retenção configurável, rotina diária, compra Kiwify/site → ativação | **Funcional e testada** |

## Rodar

Requer Docker e Supabase CLI. App na porta 3020; Supabase 54521+.

```bash
npm install
supabase start -x realtime,imgproxy,edge-runtime,logflare,vector,supavisor,studio,postgres-meta
cp .env.example .env.local        # preencha com `supabase status -o env`
npm run db:migrate
npm run db:rls                    # RLS + papel journeylab_app (senha do .env.local)
npm run db:seed                   # dados fictícios de desenvolvimento
npm run dev
```

E-mails locais (convites, recuperação de senha): Mailpit em `http://127.0.0.1:54524`.

Integrações e rotina diária (variáveis em `.env.example`):

| Variável | Uso |
|---|---|
| `KIWIFY_WEBHOOK_TOKEN` | Token do webhook Kiwify (`/api/webhooks/kiwify`) |
| `SITE_WEBHOOK_SECRET` | Assinatura HMAC-SHA256 das compras do site (`/api/webhooks/site`) |
| `INTEGRACAO_ATIVACAO_AUTOMATICA` | `true` aplica compras sem revisão manual (padrão: desligado) |
| `CRON_SECRET` | Autoriza `GET /api/cron/manutencao` (expiração de módulos e retenção) |

## Contas de teste (senha `JourneyLab2026`)

| Conta | Organização / papel |
|---|---|
| `admin@journeylab.local` | Superadmin JourneyLab |
| `ana@aurora.test` | Aurora Tecnologia (6 módulos) — Administradora |
| `rafael@aurora.test` | Aurora — RH/Recrutador |
| `bruno@aurora.test` | Aurora — Líder/Gestor (equipe Produto) |
| `carla@aurora.test` | Aurora — Colaboradora |
| `otavio@aurora.test` | Aurora — Colaborador em onboarding |
| `helena@bravo.test` | Bravo Logística (só CRM) — Administradora |
| `consultor@parceiro.test` | Aurora (RH) **e** Bravo (Administradora) |

## Testes automatizados

Com o app rodando e o seed aplicado:

```bash
node scripts/e2e/base.mjs            # isolamento entre organizações, escopos, troca de organização
node scripts/e2e/administracao.mjs   # módulos, histórico, suporte, convites, permissões
node scripts/e2e/crm.mjs             # CRM: cadastro, duplicidade, upload, conversão, exportação, isolamento
node scripts/e2e/onboarding.mjs      # Onboarding: permissões por responsável, conclusão, modelos, CRM → onboarding
node scripts/e2e/feedback-pdi.mjs    # 1:1 (privacidade das anotações no banco) e PDI (ciclo, evidências, 1:1 → PDI)
node scripts/e2e/pulse.mjs           # Pulse: respostas ilegíveis pela aplicação, mínimo, complemento, recortes
node scripts/e2e/nr1.mjs             # NR-1: agregação, acesso restrito, riscos, plano de ação, relatório
node scripts/e2e/etapa8.mjs          # Compra → ativação, rotina diária, retenção, exportações, jornada
```

Os testes reaplicam o seed das partes que alteram; rode-os com o servidor recém-iniciado
se o schema tiver mudado (o cliente Prisma fica em cache no processo de desenvolvimento).

## Interface

Layout baseado no *CRM UI Kit for SaaS Dashboards* (Figma) com os tokens
JourneyLab: menu lateral navy recolhível (preferência em cookie), barra
superior com organização/seção, troca de organização e menu da conta; painel
com boas-vindas, KPIs e listas de atividade só dos módulos contratados.
Componentes em `components/app/painel.tsx`, registrados em
`design-system/components/Card.md`.

## Segurança — onde está cada barreira

- `lib/contexto.ts`: organização ativa validada contra a associação do usuário; guardas de página e de ação.
- `lib/db.ts`: todo acesso ao banco define `app.tenant_id` / `app.usuario_id` / `app.escopo` na transação.
- `prisma/rls.sql`: papel `journeylab_app` sem bypass de RLS; policies por tenant; auditoria e histórico imutáveis.
- `lib/entitlements.ts`: único ponto de mudança de acesso a módulos (histórico obrigatório, nunca apaga dados).
