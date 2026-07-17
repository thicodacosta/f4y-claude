---
name: alocacao-tech
description: >
  Use quando o usuário tratar de Alocação de Profissionais Tech (staffing) —
  matching de profissional a contrato, gestão de pool de talentos, proposta de
  alocação/rate, renovação ou extensão de contrato. Diferente de `recrutamento`
  (posição definitiva) e de `executive-search` (C-level/board).
---

# Alocação de Profissionais Tech (Staffing)

## Objetivo

Alocar um profissional tech a um contrato por período determinado — não uma
contratação definitiva. O processo, os critérios de sucesso e o modelo
comercial são diferentes de `recrutamento`.

## Quando utilizar

- Matching de profissional do pool a um contrato/projeto do cliente.
- Proposta de alocação (rate, prazo, condições).
- Gestão de renovação, extensão ou encerramento de contrato de alocação.

## Quando NÃO utilizar

- Contratação definitiva de profissional tech → skill `recrutamento`.
- Posição C-level/board → skill `executive-search`.
- Redação da proposta comercial em si → skill `propostas-comerciais`.

## Entradas

- Necessidade do contrato/projeto do cliente: stack, prazo, modelo de
  trabalho, senioridade.
- Estado atual do pool de talentos (disponibilidade, stack).

## Saídas

- Matching proposto (profissional + contrato).
- Proposta de alocação (rate, prazo, condições).
- Registro de acompanhamento da alocação ativa.

## Fluxo de staffing

1. Entendimento do contrato/projeto do cliente: stack, prazo, modelo de
   trabalho (remoto/híbrido/presencial), senioridade necessária.
2. Matching contra o pool de talentos disponível (ou sourcing pontual, se o
   pool não tiver o perfil).
3. Validação de disponibilidade e alinhamento de expectativas com o
   profissional.
4. Proposta de alocação ao cliente (rate, prazo, condições) — usar a skill
   `propostas-comerciais`, seção "Ponto de customização por vertical:
   Alocação Tech".
5. Acompanhamento da alocação: check-ins periódicos, gestão de
   renovação/extensão ou encerramento do contrato.

## Gestão de pool de talentos

Mantenha o contexto de disponibilidade e stack do pool atualizado antes de
propor matching — evite sugerir um profissional sem confirmar disponibilidade
corrente.

## Checklist de expectativas cliente/consultor

- [ ] Prazo e modelo de trabalho confirmados com o cliente
- [ ] Rate e condições comerciais alinhados via `propostas-comerciais`
- [ ] Expectativas de renovação/extensão comunicadas desde o início
- [ ] Disponibilidade do profissional confirmada antes da proposta

## Dependências de docs/

- `docs/servicos/alocacao-tech.md` — o que o serviço inclui, para quem, modelo
  comercial
- `docs/processos/fluxo-comercial.md` — modelo de cobrança (rate vs. fee)
- `docs/processos/dados-e-privacidade.md` — gestão de consentimento do pool
- `docs/marca/tom-de-voz.md` — tom em proposta e comunicação com o profissional

## Prompts relacionados

- `prompts/propostas/alocacao-tech.md`
