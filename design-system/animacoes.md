# Animações

> Padrões de transição/animação oficiais da Find4You. Fonte: brief de marca
> confirmado por Thiago (2026-07-30).

## Duração e easing padrão

| Token | Valor |
|---|---|
| `--dur-fast` | 120ms |
| `--dur` | 200ms |
| `--dur-slow` | 320ms |
| `--ease-out` | entradas (elemento aparecendo) |
| `--ease-in-out` | mudanças de estado |

Motion é quieta e confiante — nunca bounce/overshoot, nunca parallax
decorativo. A animação existe para parecer premium, não para chamar atenção
para si mesma.

## Padrões por contexto

| Padrão | Quando usar |
|---|---|
| Fade | Aparecimento geral de elemento |
| Slide (8–16px) | Entrada de painel/drawer/toast |
| Scale (0.96 → 1) | Modal, popover |
| Reveal on scroll | Seções de página de marketing |
| Hover (lift/darken) | Cards e botões — nunca "color-flood" |

## Elevação nomeada (par com motion — sombras sempre sutis, viés azulado)

`--elevation-surface` (card em repouso) → `--elevation-hover` →
`--elevation-floating` (dropdowns/popovers) → `--elevation-modal` →
`--elevation-hero`. Nunca sombra dura/preta — sempre baixo contraste, blur +
leve offset em Y.

## Estados de hover/press

- **Botão primário:** hover escurece um degrau + glow cyan sutil (só no
  hover); press → scale 0.98.
- **Botão secundário/ghost:** hover → preenchimento neutro claro; press →
  neutro um degrau mais escuro.
- **Cards/linhas:** hover → elevação `--elevation-hover` (ou tint sutil de
  fundo) + cursor pointer — nunca inundar de cor.
- **Links:** cyan, underline só no hover.

## Uso pontual do arco orbital

O arco de marca pode girar lentamente (loop) em contextos de hero/loading —
único lugar onde uma animação "de marca" (não utilitária) é permitida.

## Acessibilidade

Respeitar `prefers-reduced-motion` é requisito, não extra (ver princípio de
acessibilidade em `CLAUDE.md` raiz) — toda transição acima deve ter
equivalente estático quando o usuário sinaliza essa preferência.
