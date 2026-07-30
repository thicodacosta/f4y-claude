---
name: business-platform
description: >
  Use quando o usuário for planejar, desenvolver ou dar manutenção no Find4You
  Business Platform — o sistema interno de gestão (CRM + ATS + Pipeline
  Comercial + Pipeline de Vagas + Financeiro + Dashboards) em `platform/`.
  Diferente da skill `website` (site institucional público) e da skill
  `lovable` (prototipagem visual) — este é o software operacional interno da
  empresa.
---

# Business Platform

## Objetivo

Definir as convenções para o código-fonte e a evolução do Business Platform,
garantindo que qualquer módulo novo siga a spec já aprovada em
`docs/business-platform/` e os padrões não-negociáveis de UX/UI, SEO (onde
aplicável), acessibilidade e performance do `CLAUDE.md` raiz.

## Quando utilizar

- Planejar, implementar ou revisar qualquer módulo do Business Platform
  (CRM, ATS, Financeiro, Automações, Dashboards, Portais).
- Estender o schema de dados, criar uma API/Server Action, ou construir uma
  tela nova dentro de `platform/`.

## Quando NÃO utilizar

- Site institucional público → skill `website`.
- Prototipagem visual rápida antes de decidir implementação final → skill
  `lovable`.
- Criar um componente visual novo sem checar o Design System primeiro →
  skill `design-system` (a extensão específica de app está em
  `docs/business-platform/design-system.md`).

## Status

Ainda em fase de planejamento — nenhum código escrito. `platform/` (código-fonte)
ainda não existe; nasce na Fase 0 de `docs/business-platform/plano-modulos.md`,
após aprovação da spec completa por Thiago.

## Entradas

- Spec completa em `docs/business-platform/` (arquitetura, modelagem de
  dados, APIs, wireframes, fluxos de usuário, roadmap, backlog).
- Componentes/tokens existentes em `design-system/`.

## Saídas

- Código-fonte de módulo/feature em `platform/` (quando iniciado).

## Regra de reuso (Design System)

Nenhum componente visual novo nasce dentro de `platform/` sem antes checar
`design-system/components/` e `docs/business-platform/design-system.md`. Se
um componente de app (Kanban, DataTable, Command Palette etc.) ainda não
existe, ele nasce no Design System, não como um one-off local.

## Padrões não-negociáveis

UX/UI, acessibilidade e performance seguem o `CLAUDE.md` raiz. SEO não se
aplica a este produto (aplicação autenticada, não indexável) — nunca aplicar
o checklist da skill `seo` aqui por engano.

## Checklist antes de considerar um módulo pronto

- [ ] Segue a modelagem de dados e a policy de RLS de
      `docs/business-platform/modelagem-dados.md` — nenhuma tabela nova sem
      policy de acesso por papel definida
- [ ] Nenhum componente visual duplicado — tudo vem de `design-system/`
- [ ] Toda automação e toda sugestão de IA fica auditável (log de execução /
      persistência do output), conforme `arquitetura.md`
- [ ] Critério de pronto da fase correspondente em `plano-modulos.md`
      verificado com quem vai usar, não só revisão técnica

## Build/deploy

A definir quando a Fase 0 iniciar — ver `docs/business-platform/arquitetura.md`
(seção Ambientes e deploy, hoje `[TODO]`).

## Dependências de docs/

- `docs/business-platform/` — spec completa (arquitetura, navegação, fluxos,
  wireframes, design system de app, modelagem de dados, APIs, plano de
  módulos, roadmap, backlog MoSCoW, diferenciais)
- `docs/servicos/` — vocabulário e escopo de cada vertical (Tecnologia,
  Corporativo, Executive Search, Alocação Tech), espelhado no campo
  `vertical` das entidades `oportunidades`/`vagas`
- `docs/clientes/` — fonte factual de cliente até a entidade `empresas` da
  plataforma assumir esse papel
