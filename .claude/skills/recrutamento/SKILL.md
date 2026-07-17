---
name: recrutamento
description: >
  Use quando o usuário pedir para redigir ou revisar descrição de vaga, definir
  perfil de candidato, montar pipeline de sourcing ou triagem para as verticais
  de Tecnologia ou Corporativo. Não cobre Executive Search (C-level/board, ver
  skill `executive-search`) nem Alocação de Profissionais Tech/staffing (ver
  skill `alocacao-tech`).
---

# Recrutamento (Tecnologia e Corporativo)

## Objetivo

Conduzir o processo de recrutamento definitivo (não staffing, não executive
search) para as duas verticais que compartilham a mesma metodologia:
Tecnologia e Corporativo. O que muda entre elas é vocabulário, canais de
sourcing e critérios de avaliação — não o processo em si.

## Quando utilizar

- Redigir ou revisar descrição de vaga de Tecnologia ou Corporativo.
- Definir perfil de candidato/requisitos junto ao cliente.
- Montar estratégia de sourcing ou critérios de triagem.
- Preparar apresentação de shortlist ao cliente.

## Quando NÃO utilizar

- Posição C-level ou board → skill `executive-search`.
- Alocação temporária/contrato de profissional tech → skill `alocacao-tech`.
- Redação da proposta comercial em si (condições, fee) → skill
  `propostas-comerciais`.

## Entradas

- Briefing do cliente: requisitos, senioridade, faixa salarial, cultura do
  time, motivo da abertura.
- Vertical de origem (Tecnologia ou Corporativo).
- Histórico do cliente em `docs/clientes/`, se recorrente.

## Saídas

- Descrição de vaga pronta para publicar.
- Critérios de triagem documentados.
- Shortlist com justificativa por candidato.

## Processo comum às duas verticais

1. Levantamento do perfil da vaga junto ao cliente (requisitos, senioridade,
   faixa salarial, cultura do time) — ver `docs/metodologia/recrutamento.md`,
   Fase 1.
2. Redação da descrição de vaga — use os templates em `prompts/vagas/`, não
   redija do zero.
3. Definição de canais e estratégia de sourcing.
4. Triagem inicial e critérios de avanço.
5. Handoff para o cliente (shortlist, entrevistas).

## Vocabulário e critérios por vertical

- **Tecnologia**: senioridade técnica (júnior/pleno/sênior/staff), stack,
  avaliação técnica (quando aplicável), canais especializados em tech.
- **Corporativo**: nível hierárquico, área funcional (Financeiro, Jurídico, RH,
  Operações etc.), competências de gestão, canais generalistas/corporativos.

Ao redigir a vaga, ajuste o vocabulário à vertical mas mantenha a mesma
estrutura de descrição e o mesmo tom consultivo descrito em `docs/marca/`.

## Checklist de qualidade antes de publicar a vaga

- [ ] Requisitos obrigatórios vs. desejáveis claramente separados
- [ ] Faixa/expectativa de remuneração alinhada com o cliente
- [ ] Tom consultivo e sofisticado, sem jargão de "vaga genérica"
- [ ] Vocabulário correto para a vertical (Tecnologia vs. Corporativo)
- [ ] Seção "Processo seletivo" parte de `docs/processos/processo-seletivo.md`

## Dependências de docs/

- `docs/servicos/recrutamento.md` — o que o serviço inclui, para quem
- `docs/metodologia/recrutamento.md` — processo interno fase a fase
- `docs/processos/processo-seletivo.md` — etapas padrão para a descrição da vaga
- `docs/processos/fluxo-comercial.md` — intake e handoff comercial
- `docs/processos/dados-e-privacidade.md` — tratamento de dados do candidato
- `docs/marca/tom-de-voz.md` — tom e vocabulário
- `docs/clientes/` — histórico de cliente recorrente

## Prompts relacionados

- `prompts/vagas/tecnologia.md`
- `prompts/vagas/corporativo.md`
- `prompts/emails/abordagem-candidato.md`
- `prompts/emails/feedback-candidato.md`

## Quando delegar

- Fechamento comercial da vaga com o cliente (proposta, condições) → skill
  `propostas-comerciais`.
- Se a posição for C-level/board → skill `executive-search`.
- Se for uma posição de alocação temporária/contrato → skill `alocacao-tech`.
