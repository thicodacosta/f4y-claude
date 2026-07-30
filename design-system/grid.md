# Grid

> Sistema de grid e breakpoints oficial da Find4You. Fonte: brief de marca
> confirmado por Thiago (2026-07-30).

## Colunas e gutters

Largura máxima de conteúdo: `--container-max` 1200px (marketing). Gutters
responsivos: 16px (mobile), 24px (tablet), 32px (desktop) — aplicados via a
classe utilitária `.f4y-container` (max-width + padding responsivo).

## Breakpoints

| Token | Valor |
|---|---|
| `--bp-mobile` | 480px |
| `--bp-tablet` | 768px |
| `--bp-desktop` | 1200px |

Nenhum componente novo pode ter largura fixa que quebre abaixo de 768px —
requisito de responsividade, não sugestão (ver `CLAUDE.md` raiz).

## Uso no site vs. materiais de marketing vs. aplicação (Business Platform)

- **Site institucional / marketing:** grid centrado, `max-width: 1200px`,
  gutters acima.
- **Aplicação (Business Platform, `docs/business-platform/`):** sidebar fixa
  de 240–260px + conteúdo fluido — não usa o container centrado de 1200px,
  é uma UI de produtividade, não uma página editorial. Ver
  `docs/business-platform/design-system.md`.
- **Materiais de marketing (ex.: carrossel Instagram):** formato próprio por
  canal, fora deste grid — ver skill `instagram`.

## Fidelidade

Variáveis CSS exatas vivem em `colors_and_type.css` —
**`[TODO] Thiago: adicionar `colors_and_type.css` a este repositório`**.
