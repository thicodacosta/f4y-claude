---
name: lovable
description: >
  Use quando o usuário for prototipar ou construir o site institucional usando o
  app builder Lovable. Coordena com as skills `website` (código-fonte final) e
  `design-system` (reuso de tokens/componentes).
---

# Lovable

## Objetivo

Prototipar e iterar visualmente o site institucional via Lovable, mantendo
consistência com o Design System e um caminho claro de sincronização com o
código-fonte final.

## Quando utilizar

- Prototipagem rápida ou iteração visual de uma tela do site institucional.

## Quando NÃO utilizar

- Manutenção fina de código já estabilizado, ou lógica que o builder não cobre
  bem → skill `website` diretamente no código-fonte.
- Criar componente/token visual novo sem checar o Design System primeiro →
  skill `design-system`.

## Entradas

- Objetivo da tela a prototipar — ver `docs/website/pages/<página>.md` se já
  houver spec.
- Tokens/componentes já existentes em `design-system/`.

## Saídas

- Protótipo funcional no Lovable, pronto para aprovação ou sincronização com
  `website/`.

## Quando usar Lovable vs. código direto

Use Lovable para prototipagem rápida e iteração visual do site institucional.
Para manutenção fina de código já estabilizado, ou lógica que o builder não
cobre bem, use a skill `website` diretamente no código-fonte.

## Fluxo de prompt para o Lovable

Ao gerar prompts para o Lovable, referencie explicitamente os tokens e
componentes já definidos em `design-system/` — não deixe o builder inventar
uma paleta ou tipografia novas. Descreva o resultado desejado em termos do
Design System existente sempre que possível.

## Sincronização com `website/`

Quando uma tela prototipada no Lovable for aprovada para produção, o código
deve ser trazido para `website/` seguindo as convenções de arquitetura
definidas na skill `website` — não deixe o site institucional dividido
permanentemente entre o ambiente do Lovable e o repositório de código.

## Reuso

Antes de gerar uma tela nova, verifique em `design-system/` se os componentes
necessários já existem. Se não existirem, o componente novo deve ser
adicionado ao Design System (via skill `design-system`), não criado apenas
dentro do Lovable.

## Checklist antes de considerar um protótipo pronto para aprovação

- [ ] Tokens/componentes usados vêm do Design System, nada inventado ad-hoc
- [ ] Tom e copy alinhados a `docs/marca/tom-de-voz.md`
- [ ] Caminho de sincronização com `website/` está claro (não fica só no Lovable)

## Dependências de docs/

- `docs/servicos/` — conteúdo factual, se a tela for uma página de serviço
- `docs/marca/tom-de-voz.md` — tom de qualquer copy prototipada

## Prompts relacionados

- `prompts/landing-pages/pagina-servico.md`
