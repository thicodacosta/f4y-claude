---
name: propostas-comerciais
description: >
  Use quando o usuário for redigir, revisar ou customizar uma proposta comercial
  para cliente, em qualquer vertical (Tecnologia, Corporativo, Executive Search,
  Alocação Tech). Skill compartilhada — as skills verticais devem apontar para
  esta em vez de reimplementar a estrutura de proposta.
---

# Propostas Comerciais

## Objetivo

Fornecer a estrutura única de proposta comercial, reutilizada pelas quatro
verticais da Find4You. Cada skill vertical (`recrutamento`, `executive-search`,
`alocacao-tech`) cuida do vocabulário e critérios específicos da sua área, mas
a estrutura e o processo de revisão de proposta vivem só aqui — evita
reimplementar a mesma lógica quatro vezes.

## Quando utilizar

- Redigir uma proposta comercial nova para qualquer vertical.
- Revisar ou customizar uma proposta existente.

## Quando NÃO utilizar

- Definir o vocabulário/critério específico da vertical antes de ter esse
  contexto de uma skill vertical (`recrutamento`, `executive-search`,
  `alocacao-tech`) — esta skill não adivinha a vertical sozinha.
- Redigir relatório de posição de Executive Search (não é proposta comercial)
  → skill `executive-search`.

## Entradas

- Vertical de origem e contexto específico (fornecido pela skill vertical que
  conduz o atendimento).
- Escopo acordado com o cliente.
- Condições comerciais (fee ou rate, conforme a vertical).

## Saídas

- Proposta comercial pronta para envio ao cliente.

## Estrutura da proposta

Use os templates em `prompts/propostas/` como esqueleto. Uma proposta
comercial da Find4You segue, nesta ordem:

1. Contexto e entendimento da necessidade do cliente
2. Escopo do serviço (o que está incluído) — referencia `docs/servicos/`
3. Metodologia resumida (referencia `docs/metodologia/`, sem repetir o
   conteúdo inteiro — só o que for relevante para esta proposta)
4. Investimento e condições comerciais (referencia `docs/processos/` para
   termos padrão de pricing/pagamento)
5. Prazos e próximos passos

## Ponto de customização por vertical

O vocabulário e os exemplos de cada seção mudam conforme a vertical de origem:

- **Recrutamento** (Tecnologia/Corporativo): foco em posição, perfil, prazo de
  entrega do processo.
- **Executive Search**: foco em confidencialidade, profundidade do mapeamento
  de mercado, exclusividade do processo.
- **Alocação Tech**: foco em rate, duração do contrato, condições de renovação.

A skill vertical que estiver conduzindo o atendimento deve fornecer esse
contexto específico; esta skill não deve adivinhar a vertical sozinha.

## Checklist de revisão antes de enviar

- [ ] Tom consultivo e sofisticado, alinhado a `docs/marca/`
- [ ] Escopo sem ambiguidade sobre o que está incluído/excluído
- [ ] Condições comerciais conferidas com `docs/processos/fluxo-comercial.md`
- [ ] Vocabulário correto para a vertical de origem
- [ ] Prazos e próximos passos explícitos

## Dependências de docs/

- `docs/servicos/recrutamento.md`, `docs/servicos/executive-search.md`,
  `docs/servicos/alocacao-tech.md` — escopo factual por vertical
- `docs/metodologia/recrutamento.md`, `docs/metodologia/executive-search.md` —
  resumo de metodologia por vertical
- `docs/processos/fluxo-comercial.md` — condições comerciais padrão
- `docs/marca/tom-de-voz.md` — tom

## Prompts relacionados

- `prompts/propostas/recrutamento.md`
- `prompts/propostas/executive-search.md`
- `prompts/propostas/alocacao-tech.md`
