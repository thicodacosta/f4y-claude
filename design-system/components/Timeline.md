# Timeline

## Objetivo

Stepper/trilha reutilizável que mostra progresso em uma jornada de múltiplas
etapas — jornada do candidato, jornada de Executive Search, ou qualquer
processo sequencial com etapas nomeadas.

## Quando usar

Mostrar em que etapa um candidato/processo está dentro de um fluxo linear
conhecido (ex.: Briefing → Mapeamento → Entrevistas → Proposta →
Onboarding). Também serve de base visual para o histórico/timeline unificada
do Business Platform (`docs/business-platform/modelagem-dados.md#atividades`),
onde os pontos passam a representar eventos, não só etapas fixas.

## Quando não usar

Kanban/pipeline com múltiplos itens em paralelo por etapa → `KanbanBoard`
(Business Platform), não Timeline — Timeline é para o progresso de **um**
item ao longo do tempo, não uma grade de vários itens.

## Estados

Cada ponto: Concluído (preenchido, cyan sólido, ligado por trilho cyan),
Atual (preenchido, com destaque), Futuro (contorno, trilho cinza).

## Variações

Horizontal (padrão, jornada de poucas etapas) e vertical (histórico/timeline
unificada com muitos eventos e texto associado a cada ponto).

## Exemplos

`Briefing ● — Mapeamento ● — Entrevistas ● — Proposta ○ — Onboarding ○`
(3 de 5 concluídas).

## Código

`[TODO] Thiago: adicionar o componente React exportado (`Timeline.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

Etapa atual anunciada via `aria-current="step"`; trilho decorativo tem
`aria-hidden`, o significado real vive no texto do rótulo de cada etapa, não
só na cor do ponto.
