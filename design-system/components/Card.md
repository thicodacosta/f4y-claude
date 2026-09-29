# Card

## Objetivo

Uma única estrutura de card compartilhada por toda a marca — todas as
especializações (Service, Case, Technology, Executive, Industry, Metric/KPI,
Testimonial, Article) reusam a mesma base, mudando só conteúdo interno, nunca
a estrutura visual (radius, elevação, padding).

## Quando usar

Qualquer agrupamento de conteúdo relacionado que precisa de contorno visual
próprio — serviço, case de cliente, tecnologia, posição executiva, métrica,
depoimento, artigo.

## Quando não usar

Listas densas de dados operacionais (ex.: candidatos, vagas em tabela) →
`DataTable` no Business Platform, não um Card por linha — Card é para
conteúdo, não para grade de dados repetitiva.

## Estados

Padrão (repouso, `--elevation-surface`), Hover (`--elevation-hover`, lift
sutil — nunca inundar de cor), Foco (quando o card inteiro é clicável, anel
de foco visível), Selecionado (borda `--primary-500` + fundo levemente
tintado, quando aplicável).

## Variações (família Card)

| Variação | Conteúdo típico |
|---|---|
| Service | Ícone, nome do serviço, descrição curta |
| Case | Métrica de destaque + nome do cliente (ex.: "+40 hires · Nubank") |
| Technology | Ícone/nome de tecnologia/parceiro (SAP, Salesforce, Oracle) |
| Executive | Posição C-level/board — ícone diferenciado |
| Industry | Setor/indústria atendida |
| Metric/KPI | Número grande + rótulo — ver também `Timeline`/KPI band para agrupamentos |
| Testimonial | Citação + avatar + cargo/empresa de quem depõe |
| Article | Título + categoria + tempo de leitura |

**Família de painel (aplicações autenticadas — JourneyLab).** Layout inspirado
no *CRM UI Kit for SaaS Dashboards* (Figma community), sempre com os tokens da
marca do produto. Implementação em `journeylab/components/app/painel.tsx`:

| Variação | Conteúdo típico |
|---|---|
| Painel (`Cartao` + `CabecalhoCartao`) | Título do bloco à esquerda, ação "Ver tudo" em botão outline à direita |
| KPI de painel (`CartaoKpi`) | Rótulo + chip de ícone, número grande tabular, barra de progresso fina **ou** linha de contexto; estado de alerta em tom destrutivo |
| Item de atividade (`ItemAtividade`) | Chip de ícone quadrado, título + subtítulo, valor à direita — lista dentro de um Painel |
| Hero de boas-vindas | Superfície `--primary` (navy) com brilho radial do acento, saudação, organização/papel/data |
| Cabeçalho de módulo (`CabecalhoModulo`) | Chip navy do produto + título/descrição, abas em controle segmentado à direita |

Complementos na mesma aplicação: tabela de dados em card (cabeçalho em
maiúsculas pequenas, linha com hover e avatar de iniciais), barra de filtros
em card, abas em controle segmentado (ativo em `--primary`), menu lateral navy
recolhível para trilho de ícones.

Estrutura fixa em todas: radius `--radius-lg` (16px), sem exceção; hairline
`#E2E6EB` **ou** `--shadow-sm/md` (normalmente borda para dado denso, sombra
para card em destaque — raramente os dois juntos); nunca borda lateral
colorida (ver `tom-visual.md`).

## Exemplos

Card de case "+40 hires · Nubank"; card de tecnologia "SAP"; card de
depoimento de "Renata Alves, Head de RH · Stone".

## Código

`[TODO] Thiago: adicionar o componente React exportado (`Card.jsx` + `.d.ts`)
ao repositório` — mesma observação de `Button.md`.

## Acessibilidade

Quando o card inteiro é um link/botão, todo o card recebe foco e `role`
apropriado (não só um link interno escondido); contraste do texto sobre a
superfície do card segue `cores.md`.
