---
name: linkedin
description: >
  Use quando o usuário quiser criar posts ou artigos para LinkedIn (página da
  empresa ou thought-leadership pessoal) alinhados ao tom consultivo da marca.
  Para decisão de pauta cross-channel, veja a skill `marketing-conteudo` primeiro.
---

# LinkedIn

## Objetivo

Executar conteúdo para LinkedIn. Assume que a pauta já foi definida (pela
skill `marketing-conteudo` ou diretamente pelo usuário) e foca no formato do
canal.

## Quando utilizar

- Redigir post de página da empresa ou de thought-leadership pessoal.
- Adaptar um artigo já escrito (`prompts/artigos/`) para o formato LinkedIn.

## Quando NÃO utilizar

- Decidir pauta/tema cross-channel antes de saber que o canal é LinkedIn →
  skill `marketing-conteudo`.
- Conteúdo de Instagram → skill `instagram`.

## Entradas

- Pauta/tema já definido.
- Formato: página da empresa ou post pessoal (confirmar se não estiver
  explícito).

## Saídas

- Post pronto para publicar no formato correto (empresa ou pessoal).

## Convenções de formato

Use os templates de `prompts/linkedin/` e o tom de `docs/marca/`. LinkedIn
admite um registro mais consultivo e argumentativo que Instagram — textos
podem ser mais longos e technical/business-oriented.

## Página empresa vs. post pessoal

- **Página da empresa** (`prompts/linkedin/post-empresa.md`): fala em nome da
  Find4You, tom institucional, foco em posicionamento de marca e cases.
  Chamadas para vagas/serviços podem ser diretas.
- **Post pessoal** (`prompts/linkedin/post-pessoal.md`): fala na voz de um
  profissional da Find4You, tom mais pessoal mas ainda sofisticado, foco em
  opinião/expertise, sem tom de propaganda direta.

Confirme com o usuário qual dos dois formatos antes de redigir, se não estiver
explícito no pedido.

## Checklist antes de publicar

- [ ] Tom consultivo mantido, sem jargão de "growth hacking" genérico
- [ ] Formato (empresa vs. pessoal) correto para o pedido
- [ ] CTA claro quando aplicável

## Dependências de docs/

- `docs/marca/tom-de-voz.md` — tom de voz e vocabulário a evitar

## Prompts relacionados

- `prompts/linkedin/post-empresa.md`
- `prompts/linkedin/post-pessoal.md`
