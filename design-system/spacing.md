# Spacing

> Escala de espaçamento oficial da Find4You. Fonte: brief de marca confirmado
> por Thiago (2026-07-30).

## Escala base

Grid de 4px. Escala de tokens: `4·8·12·16·24·32·48·64·80·96·128` →
`--space-1` … `--space-32` em `colors_and_type.css`. Alinhar sempre a um
sub-grid de 8px (o passo de 4px existe para ajustes finos, não como unidade
padrão de composição).

## Uso por contexto

| Contexto | Valor |
|---|---|
| Padding interno de componente | 16–24px |
| Ritmo entre seções (marketing) | 48–96px |
| Gutters de grid | 16/24/32px conforme breakpoint — ver `grid.md` |

Espaçamento entre elementos irmãos deve vir de `gap` em flex/grid, não de
margin por elemento (evita colapso/duplicação de margem — mesmo princípio já
aplicado a qualquer artifact/UI deste workspace).

## Fidelidade

Valores exatos como variáveis CSS vivem em `colors_and_type.css` —
**`[TODO] Thiago: adicionar `colors_and_type.css` a este repositório`**.
