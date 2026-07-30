# Find4You Business Platform — Spec

> Status: **Fase 0 (fundação) em andamento** em `platform/` — autenticação,
> papéis e shell da aplicação. Este diretório continua sendo a spec completa
> que orienta a implementação; cada módulo de negócio (Fases 1+) só é
> construído depois de aprovado aqui, preservando o que está definido neste
> conjunto de documentos.

## O que é o Business Platform

Sistema de gestão interno da Find4You — CRM + ATS + Pipeline Comercial +
Pipeline de Vagas + Financeiro + Dashboards/KPIs/Forecast — usado pela própria
equipe (consultores, recrutadores, diretoria) e, em módulos restritos, por
clientes e candidatos via portal. **Não é o site institucional** (esse é
`website/` + `docs/website/`) — é uma aplicação interna separada, com stack e
ciclo de release próprios.

## Como este diretório se organiza

Mesma regra de ouro do resto do workspace: cada informação tem um único dono.
Este diretório não repete tom de marca (`docs/marca/`), escopo de serviço por
vertical (`docs/servicos/`) ou tokens visuais (`design-system/`) — referencia
essas fontes e só documenta o que é específico da plataforma.

| Arquivo | Cobre |
|---|---|
| [`arquitetura.md`](arquitetura.md) | Stack, camadas, multi-tenancy/RLS, infra, integrações |
| [`mapa-navegacao.md`](mapa-navegacao.md) | Menu lateral, rotas, hierarquia de navegação |
| [`fluxos-usuario.md`](fluxos-usuario.md) | Fluxos completos por persona/papel |
| [`wireframes.md`](wireframes.md) | Spec de layout das telas principais |
| [`design-system.md`](design-system.md) | Componentes específicos de app (kanban, data table, command palette) — estende `design-system/` |
| [`modelagem-dados.md`](modelagem-dados.md) | Schema, entidades, relacionamentos, RLS |
| [`apis.md`](apis.md) | Superfície de API por domínio |
| [`plano-modulos.md`](plano-modulos.md) | Plano de desenvolvimento incremental por módulo |
| [`roadmap.md`](roadmap.md) | Roadmap macro (fases temporais) |
| [`backlog-moscow.md`](backlog-moscow.md) | Backlog priorizado Must/Should/Could/Won't |
| [`diferenciais.md`](diferenciais.md) | Funcionalidades de IA e inovações vs. concorrentes |

## Premissas assumidas (a confirmar com Thiago)

Onde o pedido original não especificava, este documento assume uma posição
explícita em vez de deixar em aberto — marcado como **[ASSUNÇÃO]** no arquivo
correspondente, para revisão:

1. **Single-tenant.** A plataforma é para uso interno da Find4You, não um
   produto white-label revendido a outras consultorias. RLS existe para
   controle de papel/visibilidade (admin, consultor, recrutador, cliente,
   candidato), não para isolar organizações-cliente. Se a intenção for
   revender a outras agências no futuro, a modelagem de dados em
   `modelagem-dados.md` muda (precisa de `organization_id` em todas as
   tabelas) — sinalizar antes de iniciar a Fase 1.
2. **Supabase como plataforma de dados única** (Postgres + Auth + Storage +
   Realtime), conforme especificado no pedido original — sem backend
   customizado adicional além de Edge Functions.
3. **Portal do Cliente e Portal do Candidato** são vistas restritas dentro do
   mesmo app (mesmo banco, RLS diferente), não aplicações separadas.

## Onde o código mora

`platform/` (irmão de `website/`, mesmo padrão: código real vive na raiz,
spec vive em `docs/`) — ver [`platform/README.md`](../../platform/README.md)
para setup local. A skill `business-platform` documenta as convenções de
build/lint/test/deploy reais.

## Próximo passo

Fase 0 concluída localmente (shell + auth + papéis) — falta você criar seu
próprio projeto Supabase e rodar o setup em `platform/README.md` para
validar de ponta a ponta. Depois disso, início da Fase 1 (`Pipeline
Comercial`) em `plano-modulos.md`.
