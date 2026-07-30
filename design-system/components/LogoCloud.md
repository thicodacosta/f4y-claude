# Logo Cloud

## Objetivo

Fileira de logos de clientes/parceiros — prova social rápida, sem exigir
leitura de texto.

## Quando usar

Seção de prova social em página de marketing (logo abaixo do hero ou perto
do CTA final) — reforça credibilidade citando quem já confia na Find4You.

## Quando não usar

Listar tecnologias/stack de uma vaga → `Badge` (tag), não Logo Cloud — Logo
Cloud é especificamente para logos de empresa como prova social, não para
qualquer conjunto de ícones/nomes.

## Estados

Estático. Logos em tom neutro/monocromático (não coloridos) para não competir
com a paleta da marca — só o nome/logo em `--ink` ou `--neutral-400`.

## Variações

Fileira simples (padrão) ou grade quando há muitos logos para caber em uma
linha só.

## Exemplos

`Nubank · iFood · Stone · Loft · PicPay · Creditas`

## Código

`[TODO] Thiago: adicionar o componente React exportado (`LogoCloud.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

Cada logo tem `alt` com o nome da empresa; se o logo for só texto estilizado
(como no exemplo), usar texto real (não imagem) sempre que possível, para
manter selecionável/pesquisável.
