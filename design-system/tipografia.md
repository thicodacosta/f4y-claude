# Tipografia

> Sistema tipográfico oficial da Find4You. Fonte: brief de marca confirmado
> por Thiago (2026-07-30).

## Famílias tipográficas

| Papel | Família | Peso |
|---|---|---|
| Display / títulos de marca | **Plus Jakarta Sans** | 700–800, tracking apertado (-0.02em) |
| Corpo, UI, dados | **Inter** | 400–600 |
| Métricas, IDs, código, figuras tabulares | **JetBrains Mono** | regular, `font-variant-numeric: tabular-nums` |

Plus Jakarta Sans carrega a voz "moderna, premium, geométrico-humanista" da
marca nos títulos; Inter garante legibilidade máxima em UI densa e corpo de
texto; JetBrains Mono é só para onde alinhamento numérico importa (KPIs,
tabelas, IDs) — nunca para prosa.

## Escala de tamanhos (nomeada — única fonte para tamanho de texto)

| Nível | Tamanho/Altura de linha | Uso | Classe |
|---|---|---|---|
| Display | 64/68 | Hero — no máximo um por página | `.f4y-t-display` |
| H1 | 48/56 | | `.f4y-t-h1` |
| H2 | 36/44 | | `.f4y-t-h2` |
| H3 | 28/36 | | `.f4y-t-h3` |
| H4 | 22/30 | | `.f4y-t-h4` |
| Body Large | 18/28 | | `.f4y-t-body-lg` |
| Body | 16/26 | Padrão de corpo de texto | `.f4y-t-body` |
| Small | 14/22 | | `.f4y-t-small` |
| Caption | 12/18 | | `.f4y-t-caption` |
| Label | 13/16, uppercase, tracking largo | Overlines/eyebrows | `.f4y-t-label` |

Classes legadas `.f4y-h1` etc. continuam funcionando; componentes novos devem
preferir os nomes `.f4y-t-*` acima.

## Pesos

Plus Jakarta Sans: 700 (títulos padrão), 800 (display/hero, uso pontual).
Inter: 400 (corpo), 500–600 (ênfase, labels, botões). Não usar pesos abaixo
de 400 (fragilidade de leitura) nem acima de 800.

## Regras de uso por contexto

- **Títulos e labels de UI:** sentence case ("Jornada do candidato", "Novas
  vagas") — nunca Title Case nem ALL CAPS em prosa.
- **Overlines/eyebrows/labels minúsculos:** UPPERCASE com tracking largo (ex.:
  `PEOPLE ANALYTICS`, `SLA`).
- **Nome do produto:** o wordmark renderiza `FIND4YOU` maiúsculo; em prosa o
  nome é sempre "Find4You".
- **Destaque de palavra-chave:** em um headline, colorir as 2–3 palavras mais
  relevantes no gradiente/cyan de marca (`.f4y-accent-word` /
  `.f4y-gradient-text`) — um destaque por headline, nunca a frase inteira.
- **Números/métricas:** sempre `font-variant-numeric: tabular-nums`
  (JetBrains Mono ou Inter tabular) onde dígitos alinham em coluna — KPIs,
  tabelas, SLA em dias.

## Acessibilidade

Tamanho mínimo de corpo de texto é o nível Body (16/26); Small (14/22) só
para legendas/metadados, nunca como corpo principal de leitura. Todo par
texto/fundo do token set atende WCAG AA no tamanho pretendido (ver `cores.md`
e princípio de acessibilidade em `CLAUDE.md` raiz).

## Fidelidade

Assim como em `cores.md`, o arquivo `colors_and_type.css` do pacote de
design system é a fonte exata de variáveis CSS (tamanhos em `rem`, line
-height, letter-spacing por nível) — **`[TODO] Thiago: adicionar
`colors_and_type.css` a este repositório`** para versionar os valores exatos
em vez de só a estrutura descrita aqui.
