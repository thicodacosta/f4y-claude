---
name: executive-search
description: >
  Use quando o usuário conduzir um processo de Executive Search (posições C-level
  ou board) — mapeamento de mercado, abordagem confidencial, relatório de posição,
  apresentação de shortlist. Diferente de `recrutamento` (posições não-executivas
  de Tecnologia/Corporativo) e de `alocacao-tech` (staffing temporário).
---

# Executive Search

## Objetivo

Conduzir busca executiva para posições C-level/board — processo mais longo,
mais confidencial e com entregáveis diferentes do recrutamento comum.

## Quando utilizar

- Mapeamento de mercado para posição C-level ou board.
- Abordagem confidencial a candidato executivo.
- Redação de relatório de posição ou apresentação de shortlist executiva.

## Quando NÃO utilizar

- Posição não-executiva de Tecnologia ou Corporativo → skill `recrutamento`.
- Alocação temporária de profissional tech → skill `alocacao-tech`.
- Redação da proposta comercial em si → skill `propostas-comerciais`.

## Entradas

- Briefing confidencial do cliente sobre a posição e o motivo da busca
  (sucessão, expansão, formação de board).
- Restrições de confidencialidade específicas do cliente.

## Saídas

- Relatório de posição para o cliente.
- Shortlist executiva com justificativa por candidato.

## Metodologia

Siga a metodologia de Executive Search documentada em
`docs/metodologia/executive-search.md` — esta skill não repete o conteúdo da
metodologia, apenas aplica:

1. Mapeamento de mercado (research de candidatos potenciais, não só sourcing
   ativo)
2. Abordagem confidencial e individualizada a cada candidato
3. Avaliação aprofundada (fit executivo, não só competência técnica/funcional)
4. Relatório de posição para o cliente
5. Apresentação de shortlist com justificativa por candidato

## Tom para engajamento C-level

Comunicação com candidatos e clientes nesta vertical deve ser ainda mais formal
e discreta que o padrão consultivo da marca (`docs/marca/`) — trate cada
abordagem como confidencial por padrão, mesmo quando não explicitamente
solicitado.

## Relatório e proposta ao cliente

Use os templates de `prompts/propostas/` como base para relatórios de posição
e apresentação de shortlist. Para a proposta comercial em si, use a skill
`propostas-comerciais` (seção "Ponto de customização por vertical: Executive
Search").

## Checklist de confidencialidade

- [ ] Identidade de candidatos não exposta antes da autorização deles
- [ ] Comunicação com o cliente trata o processo como confidencial
- [ ] Relatório de posição não contém informação sensível de candidatos não
      autorizados

## Dependências de docs/

- `docs/servicos/executive-search.md` — o que o serviço inclui, para quem
- `docs/metodologia/executive-search.md` — processo interno fase a fase
- `docs/processos/dados-e-privacidade.md` — confidencialidade de candidato/cliente
- `docs/marca/tom-de-voz.md` — tom, com registro ainda mais formal nesta vertical

## Prompts relacionados

- `prompts/propostas/executive-search.md`
- `prompts/emails/abordagem-candidato.md` (registro discreto/individualizado)
