---
name: seo
description: >
  Use quando o usuário for otimizar conteúdo do site ou artigos para SEO —
  pesquisa de palavra-chave, meta tags, hierarquia de heading, dados estruturados.
  Coordena com as skills `website` (SEO técnico) e `marketing-conteudo` (SEO de
  conteúdo/pauta).
---

# SEO

## Objetivo

Garantir que páginas do site e artigos estejam otimizados para busca —
palavra-chave, meta tags, hierarquia de heading, dados estruturados — e
coordenar SEO técnico e de conteúdo com as skills correspondentes.

## Quando utilizar

- Otimizar uma página do site ou artigo já escrito para SEO.
- Pesquisar palavra-chave/intenção de busca antes de definir pauta.
- Revisar dados estruturados, meta tags ou hierarquia de heading.

## Quando NÃO utilizar

- Implementar a correção técnica em si (Core Web Vitals, sitemap, robots.txt)
  → skill `website` executa, esta skill só define o critério.
- Decidir a pauta editorial → skill `marketing-conteudo` decide, esta skill
  só informa o critério de SEO.

## Entradas

- Página ou artigo a otimizar.
- Público-alvo da peça (candidato vs. cliente/contratante).

## Saídas

- Checklist on-page validado.
- Recomendações de palavra-chave/estrutura de heading.

## Checklist on-page

- [ ] Título e meta description únicos, dentro do limite de caracteres
      recomendado
- [ ] Hierarquia de heading (H1 único, H2/H3 em ordem lógica)
- [ ] Palavra-chave principal presente em título, primeiro parágrafo e ao
      menos um heading
- [ ] URLs limpas e descritivas
- [ ] Dados estruturados (schema.org) quando aplicável (artigo, organização,
      vaga)
- [ ] Imagens com alt text descritivo

## Pesquisa de palavra-chave

Antes de otimizar uma página/artigo, identifique a intenção de busca do
público-alvo daquela vertical (candidato vs. cliente/contratante) — o
vocabulário de busca muda conforme quem está procurando.

## SEO técnico (coordena com `website`)

Itens que dependem da implementação do site (velocidade de carregamento, Core
Web Vitals, sitemap, robots.txt, canonicalização) são responsabilidade
conjunta com a skill `website` — esta skill define o que precisa ser
verificado, `website` garante a implementação.

## SEO de conteúdo (coordena com `marketing-conteudo`)

Ao planejar pauta editorial, `marketing-conteudo` deve considerar
oportunidades de SEO (temas com volume de busca relevante) antes de
finalizar o calendário — esta skill fornece o critério, não decide a pauta
sozinha.

## Dependências de docs/

- `docs/website/seo.md` — SEO técnico específico da implementação do site
  (sitemap, robots.txt, Core Web Vitals, canonicalização)
- `docs/website/schema.md` — dados estruturados já mapeados por página
- `docs/marca/tom-de-voz.md` — palavra-chave e heading não podem contrariar o
  tom da marca

## Prompts relacionados

- `prompts/artigos/artigo.md`
- `prompts/landing-pages/pagina-servico.md`
