---
name: design-system
description: >
  Use quando o usuário for criar, revisar ou aplicar componentes visuais ou
  tokens de UI — para o site, landing pages, materiais de marketing ou
  protótipos no Lovable. Fonte única de verdade de UI da Find4You.
---

# Design System

## Objetivo

Ser a fonte única de verdade para tokens (cores, tipografia, espaçamento) e
componentes de UI, reutilizados por `website`, `lovable` e materiais de
marketing — evitar que o mesmo elemento visual seja reinventado em cada
contexto.

## Quando utilizar

- Antes de criar qualquer elemento visual novo, em qualquer contexto
  (`website`, `lovable`, carrossel de Instagram, landing page).
- Ao adicionar ou versionar um token/componente novo.

## Quando NÃO utilizar

- Redigir o copy/conteúdo de uma peça — isso é das skills de canal/conteúdo
  (`instagram`, `linkedin`, `website`); esta skill cobre só o visual.

## Entradas

- Necessidade visual de um contexto consumidor (`website`, `lovable`,
  `instagram`).

## Saídas

- Token ou componente documentado e disponível para reuso.

Estrutura: arquivos de token na raiz (`cores.md`, `tipografia.md`, `spacing.md`,
`grid.md`, `icones.md`, `logos.md`, `animacoes.md`, `illustrations.md`,
`tom-visual.md`), `componentes.md` como índice, e a especificação completa de
cada componente em `design-system/components/<Nome>.md`. Ver
`design-system/README.md` para o índice completo — nenhum token/componente
está definido ainda; todo campo pendente é `[TODO] Definir com Thiago`, nunca
um valor inventado.

## Consulta obrigatória antes de construir UI

Antes de criar qualquer elemento visual novo (para `website`, `lovable`, ou
materiais de marca/carrossel), verifique se um token ou componente
equivalente já existe aqui. Nunca duplique estilo/componente entre contextos —
se o Design System ainda não cobre a necessidade, o componente novo é
adicionado aqui primeiro, depois consumido pelos outros contextos.

## Governança

Ao adicionar um token ou componente novo:

1. Confirme que não existe equivalente (nome diferente, mesmo propósito)
2. Documente o novo item com seu propósito e onde é usado
3. Versione mudanças que quebram compatibilidade com uso já existente em
   `website/` ou materiais publicados

## Checklist "já existe componente equivalente?"

- [ ] Busquei em `design-system/` antes de criar algo novo
- [ ] Se não existe, o componente foi adicionado ao Design System, não apenas
      criado ad-hoc no contexto de uso
- [ ] Nomenclatura do componente é consistente com os já existentes

## Consistência entre contextos

O mesmo token/componente deve produzir o mesmo resultado visual em `website`,
`lovable` e materiais de marketing (ex.: slides de carrossel do Instagram). Se
um contexto precisar de uma variação, ela deve ser modelada como variante do
componente no Design System, não como um componente paralelo.

## Dependências de docs/

- Nenhuma direta — `design-system/` é a fonte de verdade visual; os padrões
  não-negociáveis de UX/UI/acessibilidade/performance vêm do `CLAUDE.md` raiz.

## Prompts relacionados

- `prompts/instagram/carrossel.md` (consumidor de componentes de slide)
- `prompts/landing-pages/pagina-servico.md` (consumidor de componentes de página)
