# Website — Base de Conhecimento e Spec

Documentação factual e de planejamento do site institucional: arquitetura,
SEO, rotas, inventário de componentes usados, copywriting, FAQ, blog,
analytics, performance e dados estruturados. `website/` (raiz do workspace)
continua reservado ao código-fonte real, que ainda não foi iniciado — esta
pasta é a spec que orienta esse código quando ele nascer, consumida pelas
skills `website`, `lovable` e `seo`.

Nenhum destes documentos deve duplicar conteúdo que já tem dono em outro
lugar: componentes visuais vêm de `design-system/`, escopo de serviço vem de
`docs/servicos/`, tom de voz vem de `docs/marca/tom-de-voz.md`, checklist de
SEO on-page vem da skill `seo`. Aqui só vive o que é específico do site.

## Arquivos

| Arquivo | Cobre |
|---|---|
| `arquitetura.md` | Stack, estrutura de pastas, decisões técnicas |
| `seo.md` | SEO técnico específico do site (sitemap, robots.txt, Core Web Vitals) |
| `rotas.md` | Mapa de rotas/URLs |
| `componentes.md` | Inventário de componentes do Design System usados no site |
| `copywriting.md` | Diretrizes de copy do site (aplica `docs/marca/tom-de-voz.md`) |
| `faq.md` | FAQ institucional (fonte para páginas com seção de perguntas frequentes) |
| `blog.md` | Arquitetura do blog (categorias, paginação, fonte de conteúdo) |
| `analytics.md` | Eventos e ferramentas de analytics |
| `performance.md` | Metas e budget de performance (Core Web Vitals) |
| `schema.md` | Dados estruturados (schema.org) usados no site |

## Páginas

Especificação por página (objetivo, ICP, CTA, componentes, SEO, copy, FAQ,
schema, analytics) em `pages/` — ver `pages/README.md`.

## Nenhuma decisão abaixo está confirmada

Onde uma decisão técnica ou de conteúdo ainda não existe, o arquivo
correspondente marca `[TODO] Definir com Thiago` — nunca um valor inventado.
