# Design System — Find4You

Fonte única de verdade para tokens visuais e componentes de UI, consumida por
`website/`, protótipos no Lovable e materiais de marketing (ex.: slides de
carrossel do Instagram). Governança e regra de consulta obrigatória estão na
skill `design-system` — este arquivo é o índice do conteúdo, não repete o
procedimento.

Nenhum token abaixo foi definido ainda. Onde uma escolha visual (cor, fonte,
espaçamento) ainda não existe, o arquivo correspondente marca
`[TODO] Definir com Thiago` em vez de propor um valor não confirmado.

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
