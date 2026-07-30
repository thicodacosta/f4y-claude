# Ícones

> Biblioteca de ícones oficial da Find4You. Fonte: brief de marca confirmado
> por Thiago (2026-07-30) — com uma ressalva importante, ver "Sinalização de
> substituição" abaixo.

## Biblioteca/fonte dos ícones

**Lucide** (open-source, `unpkg.com/lucide` ou pacote `lucide-react`) —
outline / line icons, traço consistente, caráter geométrico calmo, compatível
com Plus Jakarta Sans e as referências visuais da marca (Linear, Notion,
Lever usam sets de linha semelhantes).

## ⚠️ Sinalização de substituição

Lucide foi a escolha feita no brief que definiu este sistema, **não uma
biblioteca extraída de um produto Find4You já existente** (nenhuma foi
fornecida junto ao brief). Se a Find4You já tiver uma biblioteca de ícones
própria ou licenciada, ela substitui Lucide aqui — atualizar este arquivo
quando isso acontecer, sem versionar as duas em paralelo.

## Estilo e peso de traço

- Estilo: outline apenas — nunca misturar com sets "filled"/sólidos,
  multicolor, 3D ou skeuomórficos.
- Traço: 1.75–2px.
- Cor: herda `currentColor` (`--fg-2` por padrão; cyan quando ativo/selecionado).

## Tamanhos padrão

| Contexto | Tamanho |
|---|---|
| Inline (dentro de texto) | 16px |
| UI padrão (nav, botões, cards) | 20px |
| Ação primária / destaque | 24px |

## Regras de uso

- Nunca usar emoji como ícone em UI de produto (ver `tom-visual.md` e
  `docs/marca/tom-de-voz.md`).
- O monograma F4Y (logo) é o ícone do app/favicon/avatar-fallback — não
  substitui o set funcional de ícones.
- O dispositivo de marca (arco orbital + nó) pode aparecer como motivo
  decorativo (spinner de carregamento, ilustração de estado vazio, marca
  d'água) mas é distinto do set funcional de ícones — nunca usar o arco como
  "ícone" de ação.

## Ícones de UI comuns (nomes Lucide)

`search`, `users`, `user-round`, `briefcase`, `kanban`,
`layout-dashboard`, `bar-chart-3`, `calendar`, `clock`, `bell`, `settings`,
`filter`, `plus`, `chevron-right`, `check`, `star`, `message-circle`,
`map-pin`, `sparkles` (IA/People Analytics), `git-pull-request` (pipeline),
`trending-up`. Específicos de Executive Search: `award`, `crown`,
`building-2`, `target`, `globe`.
