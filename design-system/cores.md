# Cores

> Paleta oficial da Find4You. Fonte: brief de marca + logos fornecidos por
> Thiago (2026-07-30) — os valores abaixo são confirmados, não inventados.
> **Nota de fidelidade:** este arquivo documenta os valores de base e a
> estrutura da escala; os hex exatos de cada degrau intermediário (50→900)
> vivem no arquivo `colors_and_type.css` do pacote de design system —
> **`[TODO] Thiago: adicionar `colors_and_type.css` e os arquivos de logo em
> `assets/` a este repositório`** para que os tokens fiquem versionados aqui
> em vez de só descritos.

## Paleta principal

| Token | Hex | Papel |
|---|---|---|
| **Primary — Cyan** | `#28AAF0` | Único accent primário: CTAs, links, estados ativos, dado-chave. Decisivo mas usado com moderação — a maior parte da UI é neutra. |
| **Secondary — Indigo** | `#5860A9` | Extremidade do gradiente de marca; ênfase secundária, gráficos, lado violeta de gradientes. |
| **Brand gradient** | `#28AAF0 → #5860A9` (`--brand-gradient`) | Superfícies hero, logo ativo, cards de ênfase primária, preenchimento de gráfico — nunca como fundo de página inteira. |
| **Brand gradient soft** | tint suave do mesmo par | Fundos de destaque discretos (ex.: badge "IA"). |

## Paleta de apoio / neutros

| Token | Hex | Papel |
|---|---|---|
| **Fundo do app** | `#F6F8FA` | Fundo padrão de superfície — slate frio. |
| **Ink (texto primário)** | `#383A47` | Cor de texto principal. |
| **Warm gray** | `#7F786D` | Corpo de texto "humanizado" (copy longa) — usar com moderação para não brigar com a frieza da marca. |
| **Warm gray 2** | `#ADA59C` | Variante mais clara do warm gray. |
| **Inverse surface** | `#1B2030` | Painéis escuros, KPI band sobre fundo invertido. |
| **Border (hairline)** | `#E2E6EB` | Divisores/bordas padrão. |
| **Border forte / grid** | `#D0D2D4` | Linhas de grade mais fortes, divisores de seção. |

Neutros completos (escala 0–900, slate frio) e a escala secundária (indigo
0–900) existem como rampas de 10 degraus cada — ver nota de fidelidade acima
para os hex exatos de cada degrau.

## Cores de estado (sucesso, erro, alerta, informação)

| Estado | Hex |
|---|---|
| Success | `#15A66B` |
| Warning | `#F5A623` |
| Danger | `#E5484D` |
| Info | mesmo tom do Primary (`#28AAF0`) |

## Arco espectro (uso restrito)

O arco orbital do logo usa gradiente espectro completo (cyan→violeta→verde→
amarelo→laranja→vermelho) — **reservado ao dispositivo de marca (logo)**.
Não usar como gradiente de UI. Exceção pontual permitida: um traço fino de
progresso/celebração, com muita moderação.

## Regras de uso

- Cyan é o único accent decisório — não introduzir uma segunda cor de accent
  concorrente.
- A maior parte da interface é neutra (fundo `#F6F8FA`/branco); cor entra para
  guiar atenção, não para decorar.
- Nenhum card com borda lateral colorida ("acento" de template de RH) — ver
  `tom-visual.md`, seção "O que evitar visualmente".
- Sombras são sutis e com viés azulado (ver `animacoes.md`/tokens de
  elevação), nunca pretas/duras.

## Contraste e acessibilidade

Todo par texto/fundo do token set deve atender WCAG AA no tamanho pretendido
(ver princípio de acessibilidade em `CLAUDE.md` raiz). Os pares confirmados
acima (`#383A47` sobre `#F6F8FA`/branco) atendem AA; qualquer combinação nova
deve ser validada antes de entrar em produção.
