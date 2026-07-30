# Componentes — Índice

> Índice geral dos componentes de UI da Find4You. A especificação completa de
> cada componente (objetivo, estados, variações, exemplos, código,
> acessibilidade) vive em `components/<Nome>.md` — este arquivo não repete
> esse conteúdo, apenas organiza e referencia. Fonte dos componentes
> confirmados: brief de marca aprovado por Thiago (2026-07-30).

## Componentes especificados

| Componente | Arquivo | Status |
|---|---|---|
| Botão | `components/Button.md` | Confirmado |
| Card (+ família Service/Case/Technology/Executive/Industry/Metric/Testimonial/Article) | `components/Card.md` | Confirmado |
| Badge | `components/Badge.md` | Confirmado |
| Avatar | `components/Avatar.md` | Confirmado |
| Input (campo de formulário) | `components/Input.md` | Confirmado |
| Timeline | `components/Timeline.md` | Confirmado |
| CTA (banner) | `components/CTA.md` | Confirmado |
| FAQ Accordion | `components/FAQAccordion.md` | Confirmado |
| Logo Cloud | `components/LogoCloud.md` | Confirmado |
| Hero | `components/Hero.md` | `[TODO] Definir com Thiago` |
| Navbar | `components/Navbar.md` | `[TODO] Definir com Thiago` |
| Footer | `components/Footer.md` | `[TODO] Definir com Thiago` |
| Section | `components/Section.md` | `[TODO] Definir com Thiago` |

Componentes específicos de aplicação (Kanban, DataTable, Command Palette,
Drawer etc., usados só pelo Business Platform) vivem em
`docs/business-platform/design-system.md` — não duplicados aqui, mas
herdam os mesmos tokens de cor/tipografia/espaçamento confirmados neste
diretório.

Ver também `botoes.md`, `cards.md` (ponteiros de contexto) e `formularios.md`
(agora ponteiro para `components/Input.md`).

## Nomenclatura

PascalCase para o arquivo/componente (ex.: `Button.md` → `<Button />`),
kebab-case para classe CSS utilitária (ex.: `.f4y-btn-primary`).

## Como adicionar um componente novo

Ver skill `design-system`, seção "Governança" — este índice só lista o que já
existe, não define o processo de adição.
