# FAQ Accordion

## Objetivo

Padrão elegante de expandir/colapsar para seções de perguntas frequentes —
usado na spec de FAQ do site (`docs/website/faq.md`) e em qualquer página de
serviço que precise responder objeções comuns.

## Quando usar

Lista de perguntas e respostas onde só uma (ou poucas) devem estar expandidas
por vez, evitando uma página longa de texto corrido.

## Quando não usar

Navegação estrutural (menu, sumário) → não é o mesmo padrão, mesmo que
visualmente pareça um accordion.

## Estados

Colapsado (padrão), Expandido (altura anima até o conteúdo, chevron rotaciona
180°), Hover (leve destaque do item antes de clicar), Foco (anel de foco
visível no cabeçalho clicável).

## Variações

Uma pergunta expandida por vez (padrão, mais comum) ou múltiplas expandidas
simultaneamente (quando o conteúdo de cada resposta é curto).

## Exemplos

"Como funciona o Executive Search? ⌃ (expandido) — Mapeamos e abordamos
ativamente lideranças de mercado com uma metodologia consultiva." / "Qual o
SLA médio? ⌄" / "Atendem recrutamento corporativo? ⌄"

## Código

`[TODO] Thiago: adicionar o componente React exportado (`FAQAccordion.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

Cabeçalho de cada item é um `<button>` com `aria-expanded`; conteúdo
associado via `aria-controls`/`id`; animação de altura respeita
`prefers-reduced-motion` (troca para exibição instantânea).
