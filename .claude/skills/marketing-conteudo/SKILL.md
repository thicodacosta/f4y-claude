---
name: marketing-conteudo
description: >
  Use quando o usuário pedir estratégia de conteúdo cross-channel, calendário
  editorial, pauta de artigo/blog, ou quando não estiver claro em qual canal
  publicar. Esta skill decide pauta/tom/prioridade e delega a execução às skills
  de canal (`instagram`, `linkedin`). Não é para redigir o post em si — isso é
  das skills de canal.
---

# Marketing de Conteúdo (orquestração cross-channel)

## Objetivo

Decidir o que comunicar e quando, antes de qualquer canal específico entrar em
ação — camada de estratégia acima das skills de canal.

## Quando utilizar

- Definir pauta/tema de conteúdo antes de escolher o canal.
- Montar ou revisar calendário editorial.
- Decidir formato (artigo, carrossel, post curto) mais adequado ao objetivo.

## Quando NÃO utilizar

- Redigir o post final no formato de um canal específico → skill `instagram`
  ou `linkedin`.
- Otimizar conteúdo já escrito para SEO → skill `seo`.

## Entradas

- Objetivo de negócio por trás do pedido (atrair candidatos, posicionar marca,
  anunciar case).
- Verticais ativas no momento.

## Saídas

- Pauta definida (tema, objetivo, formato, canal).
- Calendário editorial atualizado.

## Calendário e estratégia

1. Entenda o objetivo de negócio por trás do pedido (atrair candidatos?
   posicionar a marca para clientes? anunciar um case?) antes de definir a
   pauta.
2. Priorize temas alinhados às verticais ativas no momento (Tecnologia,
   Corporativo, Executive Search, Alocação Tech) e ao tom descrito em
   `docs/marca/`.
3. Defina o formato mais adequado ao objetivo (artigo longo, carrossel, post
   curto) antes de escolher o canal.

## Fluxo de artigo/blog

Para conteúdo longo-form (artigo, blog), use os templates em `prompts/artigos/`
e o tom de `docs/marca/`. Artigos podem depois ser adaptados para posts de
canal pelas skills `instagram`/`linkedin`, mas nascem aqui como peça original.

## Regra de delegação para skills de canal

Depois que a pauta e o formato estão definidos, delegue a execução:

- Carrossel/post de Instagram → skill `instagram`
- Post/artigo de LinkedIn → skill `linkedin`

Esta skill não deve redigir o post final no formato do canal — isso duplicaria
lógica que já existe nas skills de canal. Ela decide o "o quê" e o "por quê";
as skills de canal decidem o "como" no formato específico daquele canal.

## Checklist antes de delegar a um canal

- [ ] Objetivo de negócio explícito, não implícito
- [ ] Vertical(is) em foco definida(s)
- [ ] Formato escolhido antes do canal (não o contrário)
- [ ] Oportunidade de SEO considerada, se o formato for artigo (coordenar com
      skill `seo`)

## Dependências de docs/

- `docs/marca/tom-de-voz.md` — tom para qualquer peça de conteúdo
- `docs/servicos/` — contexto factual de cada vertical, se a pauta referenciar
  um serviço

## Prompts relacionados

- `prompts/artigos/artigo.md`
