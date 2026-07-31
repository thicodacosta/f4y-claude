# Design System — Find4You

Fonte única de verdade para tokens visuais e componentes de UI, consumida por
`website/`, protótipos no Lovable e materiais de marketing (ex.: slides de
carrossel do Instagram). Governança e regra de consulta obrigatória estão na
skill `design-system` — este arquivo é o índice do conteúdo, não repete o
procedimento.

Tokens de cor, tipografia, espaçamento, grid, ícones, logo, animação e tom
visual foram confirmados por Thiago em 2026-07-30 (brief de marca + logos) —
ver cada arquivo abaixo. O que ainda falta em cada um está marcado
`[TODO] Definir com Thiago` (ex.: área de proteção do logo) ou
`[TODO] Thiago: adicionar <arquivo>` quando o valor exato existe em um
arquivo fonte (`colors_and_type.css`, assets de logo, código de componente
React) que ainda não foi versionado neste repositório — a estrutura e os
valores de base já são reais, só a fidelidade pixel-a-pixel de alguns detalhes
depende desses arquivos serem adicionados.

## Tokens (arquivos na raiz)

| Arquivo | Cobre |
|---|---|
| `cores.md` | Paleta de cores |
| `tipografia.md` | Famílias tipográficas, escala, pesos |
| `spacing.md` | Escala de espaçamento |
| `grid.md` | Grid e breakpoints |
| `icones.md` | Biblioteca de ícones e regras de uso |
| `logos.md` | Versões do logo e regras de uso |
| `animacoes.md` | Padrões de transição/animação |
| `illustrations.md` | Estilo de ilustração, se aplicável |
| `tom-visual.md` | Personalidade visual da marca (complementa `docs/marca/tom-de-voz.md`, que cobre tom textual) |
| `assets/` | Arquivos reais de logo (ver `logos.md` para versões recebidas vs. pendentes) |

## Componentes

| Arquivo | Cobre |
|---|---|
| `componentes.md` | Índice geral de componentes e regra de nomenclatura |
| `botoes.md` | Ponteiro para a especificação completa em `components/Button.md` |
| `formularios.md` | Padrões de formulário (sem componente formal ainda) |
| `cards.md` | Ponteiro para a especificação completa em `components/Card.md` |
| `components/` | Especificação completa por componente (ver `components/README.md`) |

## Regra de reuso

Antes de criar qualquer elemento visual novo, verifique se um token ou
componente equivalente já existe aqui — ver skill `design-system` para o
procedimento completo de consulta e governança.
