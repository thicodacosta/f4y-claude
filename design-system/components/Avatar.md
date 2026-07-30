# Avatar

## Objetivo

Representar uma pessoa (consultor, recrutador, candidato, contato de
cliente) de forma consistente em qualquer lista, card ou cabeçalho.

## Quando usar

Sempre que uma pessoa é referenciada em UI — responsável por uma
oportunidade, recrutador de uma vaga, contato de um cliente, autor de um
comentário.

## Quando não usar

Representar uma empresa/marca → usar o logo da empresa (quando disponível)
em um container do mesmo tamanho, não um Avatar com iniciais da empresa.

## Estados

Padrão (com foto), Fallback (sem foto — iniciais), Hover (quando clicável,
leve elevação/anel).

## Variações

- **Com foto:** imagem do usuário, recorte circular.
- **Fallback de iniciais:** duas letras (primeiro nome + sobrenome), fundo em
  gradiente de marca ou indigo sólido — nunca cor aleatória por usuário
  (mantém consistência visual mesmo sem foto).
- **Tamanhos:** pequeno (listas densas/tabelas), padrão (cards), grande
  (cabeçalho de perfil).

## Exemplos

`AC` (Camila Andrade, fundo indigo sólido); avatar com foto de candidato no
perfil estilo LinkedIn Recruiter.

## Código

`[TODO] Thiago: adicionar o componente React exportado (`Avatar.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

`alt` descritivo na imagem (nome da pessoa, não "avatar" genérico); fallback
de iniciais tem contraste AA garantido pela combinação fundo-gradiente/
indigo + texto branco.
