# Design System — Extensão para o Business Platform

> Este arquivo não define tokens novos. Cor, tipografia, espaçamento, ícones e
> animação vêm exclusivamente de `design-system/` — confirmados por Thiago em
> 2026-07-30 (ver `design-system/cores.md`: Primary cyan `#28AAF0`, Secondary
> indigo `#5860A9`, fundo `#F6F8FA`; `tipografia.md`: Plus Jakarta Sans
> (display) + Inter (corpo/UI) + JetBrains Mono (dados tabulares);
> `icones.md`: Lucide, outline). O Business Platform **não inventa uma
> paleta própria** — herda esses tokens como qualquer outro artefato da
> marca. Onde um detalhe exato (hex de degrau intermediário, variável CSS)
> ainda depende de `colors_and_type.css` não versionado neste repositório,
> `design-system/cores.md`/`tipografia.md` sinalizam isso explicitamente.

## Por que este arquivo existe

`design-system/` hoje cobre o vocabulário de um site institucional e
materiais de marketing (botões, cards, hero, navbar, footer). Uma aplicação
de produtividade densa em dados precisa de componentes que o site nunca vai
usar — data table, Kanban, command palette, drawer. Esses nascem aqui como
especificação primeiro, mas **passam a viver em `design-system/components/`**
assim que implementados, seguindo a mesma regra de reuso do resto do
workspace: nenhum componente visual duplicado entre site e app.

## Componentes novos exigidos pelo app (a criar em `design-system/components/` quando implementados)

| Componente | Uso | Estado |
|---|---|---|
| `DataTable` | Listas de clientes, vagas, candidatos, oportunidades (colunas configuráveis, ordenação, seleção em massa) | A criar |
| `KanbanBoard` / `KanbanCard` | Pipeline Comercial e Pipeline de Vagas | A criar |
| `CommandPalette` | Busca universal `Cmd/Ctrl+K` | A criar |
| `Drawer` (painel lateral) | Detalhe de card sem sair do Kanban | A criar |
| `StatBox` (card de KPI) | Dashboard — valor + variação + sparkline; especialização do `Card` (variação Metric/KPI já confirmada em `design-system/components/Card.md`) | A criar |
| `Sidebar` (nav colapsável) | Shell da aplicação | A criar |
| `Toast` / `NotificationCenter` | Automações e realtime | A criar |
| `FilterBar` | Filtros globais reutilizados em Dashboard, Pipelines, Relatórios | A criar |
| `EmptyState` | Estados vazios consistentes (nenhuma vaga, nenhum resultado de busca) | A criar |

Dois componentes que este documento antes listava como "a criar" **já estão
confirmados** em `design-system/components/` e só precisam ser consumidos,
não recriados: status de vaga/candidato/oportunidade usa `Badge.md` (tons
info/warning/success/danger); o histórico unificado por entidade usa
`Timeline.md` na variação vertical (o próprio arquivo já prevê esse uso).

Cada componente ainda "a criar" segue o mesmo formato de spec já usado em
`design-system/components/` (ver `Button.md`, `Card.md` como referência de
estrutura) quando for detalhado — este documento só registra que existem e
para que servem, não duplica a spec de componente aqui.

## Modo escuro

Requisito desde o primeiro componente, não retrofit. `design-system/cores.md`
ainda não publica o par escuro de cada token (o fundo `#F6F8FA`/superfícies
claras é o que está confirmado) — dark mode do Business Platform deriva os
tons escuros a partir dos mesmos tokens (cyan/indigo permanecem os accents;
`--inverse-surface` `#1B2030` já confirmado serve de base para o fundo
escuro) em vez de inventar uma paleta escura paralela.

## Densidade de informação

Diferente do site (muito espaço em branco, poucos elementos por tela), o app
é uma ferramenta de produtividade: Kanban e DataTable priorizam densidade
sobre respiro visual, mas sem abandonar a tipografia/hierarquia do Design
System — a referência é como Linear e a Salesforce Lightning equilibram
densidade com clareza, não um grid apertado de planilha.

## Ícones

Reusa `design-system/icones.md` — nenhuma biblioteca de ícone paralela
introduzida só para o app.
