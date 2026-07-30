# Badge

## Objetivo

Pílula de status (estado de um registro no pipeline) ou tag de categoria
(vertical, skill, plataforma) — sempre orientada por tom (`tone-driven`), não
por uma cor arbitrária por instância.

## Quando usar

Status de candidato/vaga/oportunidade (ex.: "Triagem", "Entrevista",
"Contratado", "Reprovado"); tag de vertical (Tech, Corporativo, Executive,
Alocação); tag de skill/tecnologia (React, AWS, Remoto, Sênior); tag de
plataforma/parceiro (SAP, Salesforce).

## Quando não usar

Ação clicável → `Button` (Ghost/Text), não um Badge com `onClick` disfarçado.

## Estados

Estático por padrão (não interativo). Quando usado como filtro clicável
(ex.: seleção de skill), ganha estado Selecionado (preenchimento sólido em
vez de tint) e Hover leve.

## Variações

| Tom | Uso |
|---|---|
| Info (cyan) | Status neutro em andamento — ex. "Triagem" |
| Warning (amber) | Atenção — ex. "Entrevista" pendente há muito tempo |
| Success (verde) | Positivo — ex. "Contratado" |
| Danger (vermelho) | Negativo — ex. "Reprovado" |
| Neutral | Tags de categoria/skill sem conotação de status (ex. "Tech", "React", "AWS") |
| Primary sólido | Destaque especial — ex. badge "✦ IA" para recomendação/insight gerado por IA |

Formato: pílula (`--radius-pill`), fundo tintado + texto no tom sólido
correspondente (nunca texto branco sobre tint claro).

## Exemplos

`● Triagem` `● Entrevista` `● Contratado` `● Reprovado` (status); `Tech`
`Corporativo` `Executive` `Alocação` (vertical); `React` `Node.js` `AWS`
`Remoto` `Sênior` (skill/atributo); `✦ IA` (badge de recomendação de IA).

## Código

`[TODO] Thiago: adicionar o componente React exportado (`Badge.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

Cor nunca é o único portador de significado — todo Badge de status carrega
um rótulo de texto junto (nunca só um ponto colorido); contraste do texto
sobre o tint atende AA.
