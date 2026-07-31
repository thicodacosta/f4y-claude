# Logos

> Regras de uso da marca Find4You. Fonte: brief de marca confirmado por
> Thiago (2026-07-30). Arquivos reais recebidos em 2026-07-30 e versionados
> em `assets/` — wordmark completo e monograma F4Y, ambos coloridos. Ainda
> faltam as versões P&B e o monograma branco (ver tabela abaixo).

## O logo

Wordmark horizontal `FIND·4·YOU`:

- **FIND** — gradiente cyan → azul.
- **4** — slate escuro sólido (`#383A47`).
- **YOU** — gradiente azul → violeta.

À direita, o dispositivo de marca: um arco orbital aberto com um pequeno
nó/marcador no topo — evoca busca, rastreamento, "alvo encontrado", uma
órbita de talentos. O arco percorre um gradiente espectro completo (cyan no
topo → violeta → verde → amarelo → laranja → vermelho na base-esquerda),
referência deliberada à diversidade de talentos e do espectro humano. O
monograma **F4Y** é a versão compacta do mesmo conceito.

## Versões do logo

| Versão | Arquivo | Uso | Status |
|---|---|---|---|
| Wordmark completo, cor | `assets/Find4You - Logo 1.png` | Headers, marketing, login | ✅ Recebido — PNG 4647×1839, fundo transparente |
| Wordmark completo, P&B | `Find4You - Logo 1 - PB.png/.jpg` | Contextos sem cor | `[TODO] Thiago: adicionar` |
| Monograma F4Y, cor | `assets/Find4You - Logo 2.jpg` | Ícone de app, avatar, favicon, espaços apertados | ✅ Recebido — JPG 624×584, **fundo branco sólido** (não é transparente) |
| Monograma F4Y, P&B | `Find4You - Logo 2 - PB.png` | Contextos sem cor | `[TODO] Thiago: adicionar` |
| Monograma F4Y, branco | `Logo F4Y - Branco.png` | Fundos escuros/de marca | `[TODO] Thiago: adicionar` |

### Nota técnica — fundo do monograma

O monograma recebido é `.jpg` (sem canal alfa), com fundo branco embutido na
própria imagem — não um arquivo com transparência. Isso funciona bem em
qualquer contexto (o branco embutido já resolve contraste do "4" escuro), mas
significa que ele **não pode ser usado diretamente sobre um fundo colorido**
esperando transparência. Para uso no app, ver `docs/business-platform/
design-system.md` — a versão em `platform/public/logo-monogram.png` é o
mesmo arquivo, só recortado em quadrado perfeito (624×624, mesmo fundo
branco). Quando a versão branca/transparente do monograma existir, ela
substitui essa dependência do fundo branco embutido.

## Área de proteção e tamanho mínimo

`[TODO] Definir com Thiago` — o brief não especifica clear space nem
tamanho mínimo em pixels/mm; não inventar um valor até confirmação.

## Uso sobre fundo claro/escuro

Wordmark colorido sobre fundo claro/branco; monograma branco
(`Logo F4Y - Branco.png`) sobre fundo escuro ou sobre a superfície
`--inverse-surface` (`#1B2030`).

## Usos proibidos

- Nunca recolorir o arco espectro (é um elemento fixo de marca, não um
  token de tema).
- Nunca distorcer proporção do wordmark ou do monograma.
- Nunca usar o monograma como substituto de um ícone funcional de UI (ver
  `icones.md`) — ele é identidade de marca, não parte do sistema de ícones.
