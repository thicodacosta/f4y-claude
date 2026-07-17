---
name: website
description: >
  Use quando o usuário for desenvolver, revisar ou dar manutenção no código-fonte
  do site institucional em `website/`, fora do fluxo de prototipagem no Lovable
  (ver skill `lovable`).
---

# Website

## Objetivo

Definir as convenções para o código-fonte do site institucional e garantir que
sigam os padrões não-negociáveis de UX/UI, SEO, acessibilidade e performance.

## Quando utilizar

- Desenvolver, revisar ou dar manutenção no código-fonte em `website/`.
- Trazer para produção uma tela aprovada no Lovable.

## Quando NÃO utilizar

- Prototipagem rápida/iteração visual antes de decidir a implementação final →
  skill `lovable`.
- Criar um componente visual novo sem checar o Design System primeiro → skill
  `design-system`.

## Entradas

- Especificação da tela/página em `docs/website/pages/<página>.md`, ou uma
  tela aprovada no Lovable.
- Componentes/tokens já existentes em `design-system/`.

## Saídas

- Código-fonte da página/feature no repositório do site.

Este skill ainda não tem stack definido — `website/` está vazio. Ao iniciar o
projeto, documente aqui o stack escolhido e os comandos de build/lint/test/deploy
reais.

## Regra de reuso (Design System)

Antes de criar qualquer componente de UI, verifique em `design-system/` se um
componente equivalente já existe. Nunca duplique um componente visual entre o
site e outros artefatos (landing pages, materiais de marketing) — se um
componente novo for necessário, ele nasce no Design System (skill
`design-system`) e é importado aqui, não recriado localmente.

## Padrões não-negociáveis

Os princípios de UX/UI, SEO, acessibilidade e performance para qualquer código
deste projeto estão definidos no `CLAUDE.md` raiz — esta skill não os repete,
apenas aplica no contexto específico do site. Para SEO técnico (Core Web
Vitals, sitemap, dados estruturados), coordene com a skill `seo`.

## Checklist antes de considerar uma página pronta

- [ ] Nenhum componente visual duplicado — tudo vem de `design-system/`
- [ ] Padrões de UX/UI, acessibilidade e performance do `CLAUDE.md` raiz
      verificados
- [ ] Checklist on-page da skill `seo` executado

## Build/deploy

A definir quando o projeto for iniciado.

## Dependências de docs/

- `docs/website/` — spec de arquitetura, SEO técnico, rotas, componentes
  usados, copywriting, FAQ, blog, analytics, performance e schema do site
- `docs/website/pages/` — especificação por página (objetivo, ICP, CTA,
  componentes, SEO, copy, FAQ, schema, analytics)
- `docs/servicos/` — conteúdo factual das páginas de serviço
- `docs/marca/tom-de-voz.md` — tom de qualquer copy no site

## Prompts relacionados

- `prompts/landing-pages/pagina-servico.md`
