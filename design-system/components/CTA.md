# CTA (banner)

## Objetivo

Um único padrão de banner de chamada-para-ação, reutilizado em toda página de
marketing — não um banner desenhado do zero por página.

## Quando usar

Fechamento de página de serviço, fim de artigo de blog, seção intermediária
de landing page — sempre que a página precisa converter a atenção do leitor
em uma ação (agendar reunião, falar com consultor).

## Quando não usar

Ação operacional dentro do Business Platform (ex. "Publicar vaga") → isso é
um `Button` Primary comum dentro do fluxo de trabalho, não um CTA Banner —
CTA Banner é um padrão de marketing/conversão, não de produto.

## Estados

Estático (não interativo em si — o botão dentro dele tem seus próprios
estados, ver `Button.md`).

## Variações

CTA inline (dentro de um bloco de texto, mais discreto), CTA de seção (o
padrão principal — título + subtítulo + botão sobre fundo em gradiente de
marca), CTA final de página (mesma estrutura, maior destaque/tamanho).

Fundo: `--brand-gradient` (cyan → indigo) — um dos poucos lugares onde o
gradiente ocupa uma superfície inteira (banner, não a página toda). Texto
branco, botão em contraste (fundo branco, texto no tom do gradiente).

## Exemplos

"Pronto para montar sua equipe Tech? — Fale com um consultor Find4You hoje."
+ botão "Agendar uma reunião".

## Código

`[TODO] Thiago: adicionar o componente React exportado (`CTABanner.jsx` +
`.d.ts`) ao repositório`.

## Acessibilidade

Texto branco sobre o gradiente mantém contraste AA em toda a extensão do
banner (checar especialmente a ponta mais clara do gradiente cyan); botão
interno segue `Button.md`.
