# Button

## Objetivo

Ação primária de interação em qualquer superfície da marca — do CTA de
marketing ("Solicitar Especialista") às ações operacionais do Business
Platform ("Publicar vaga").

## Quando usar

Qualquer ação clicável que dispara uma mudança de estado, navegação ou
submissão. Ícone-only quando o espaço é restrito e o rótulo é óbvio pelo
ícone + contexto (sempre com rótulo acessível, ver Acessibilidade).

## Quando não usar

Navegação entre páginas sem ação associada → usar `Text`/link (cyan,
underline só no hover), não um botão Ghost disfarçado de link.

## Estados

Default, Hover, Focus, Disabled, Loading — todo variante abaixo precisa
suportar os cinco.

- **Hover (Primary):** escurece um degrau (`--primary-600`) + glow cyan sutil.
- **Hover (Secondary/Ghost/Outline):** preenchimento `--neutral-100`.
- **Focus:** anel de foco visível (`--shadow-focus`), nunca suprimido.
- **Press:** scale 0.98 + um degrau mais escuro que o hover.
- **Loading:** spinner substitui o ícone/rótulo à esquerda, botão permanece
  na mesma largura (evita layout shift).
- **Disabled:** opacidade reduzida, sem estado de hover/press.

## Variações

| Variante | Uso |
|---|---|
| Primary | Ação principal da tela — cyan sólido, texto branco |
| Secondary | Ação secundária — outline/preenchimento neutro |
| Ghost | Ação terciária, baixo peso visual |
| Outline | Alternativa a Secondary quando o contexto pede borda mais definida |
| Text | Link com peso de botão, sem fundo |
| Icon Button | Só ícone, com rótulo acessível obrigatório |
| FAB | Ação flutuante primária (mobile/portal do candidato) |

Tamanhos: padrão e pequeno (`--radius-md` 12px em ambos).

## Exemplos

"Solicitar Especialista" (Primary, marketing), "Publicar vaga" (Primary,
Business Platform), "Cancelar" (Secondary/Outline), "Ver perfil" (Text),
botão `+` circular (Icon Button/FAB).

## Código

`[TODO] Thiago: adicionar o componente React exportado (`Button.jsx` +
`.d.ts`) ao repositório` — este arquivo documenta o contrato visual/de
estado; a implementação de referência vive no pacote de design system
mencionado no brief, ainda não versionado aqui.

## Acessibilidade

Contraste mínimo AA (`cores.md`), foco visível sempre (`:focus-visible` com
`--shadow-focus`), área de toque mínima adequada a mobile, `aria-label`
obrigatório em Icon Button, e `aria-busy`/spinner acessível no estado
Loading.
