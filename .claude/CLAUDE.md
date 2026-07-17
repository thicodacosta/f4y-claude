# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sobre a Find4You

A Find4You é uma consultoria especializada em Recruitment & Executive Search, atuando em três verticais de negócio:

- **Tecnologia**
- **Corporativo**
- **Executive Search**

Além disso, a empresa oferece **Alocação de Profissionais Tech** (staffing).

**Tom de marca:** consultivo, sofisticado e orientado a negócios. Qualquer conteúdo gerado neste workspace — site, posts, propostas, e-mails, descrições de vagas — deve refletir esse posicionamento. Evite tom informal, genérico ou "startup casual"; a comunicação deve soar como a de uma consultoria de alto nível falando com executivos e decisores.

## Como este workspace é organizado

Este repositório é o workspace operacional da Find4You dentro do Claude Code. A regra de ouro é: **cada informação tem um único dono**. O CLAUDE.md nunca repete o que já está em uma Skill; uma Skill nunca repete um fato que já está em `docs/`; `docs/` nunca contém instrução de "como agir" (isso é papel da Skill que consome o doc).

| Camada | Papel |
|---|---|
| **CLAUDE.md** (este arquivo) | Visão de negócio, mapa de pastas, índice de Skills, princípios não-negociáveis de código |
| **`.claude/skills/`** | Procedimentos operacionais por área — workflow, checklists, quando/como agir. Ver índice abaixo |
| **`docs/`** | Base de conhecimento factual e estável: marca, clientes, cases, metodologia, processos, serviços, spec do site (`docs/website/`) |
| **`prompts/`** | Templates de prompt reutilizáveis por tipo de conteúdo |
| **`design-system/`** | Fonte única de verdade de tokens/componentes de UI |
| **`website/`** | Código-fonte do site institucional (ainda não iniciado) — spec/planejamento vive em `docs/website/`, não aqui |
| **`automations/`** | Scripts e config específicos de cada integração — o procedimento (fluxo, checklist, troubleshooting) continua sendo da Skill correspondente, nunca duplicado aqui |

**Regra de organização:** ao criar um novo artefato (documento, prompt, componente, script), coloque-o na pasta já existente correspondente ao seu tipo em vez de criar novas pastas de nível superior.

## Índice de Skills

Cada skill em `.claude/skills/<nome>/SKILL.md` contém o procedimento completo daquela área — não duplicado aqui. Use este índice só para saber qual acionar:

- **`recrutamento`** — vagas, sourcing e triagem para as verticais Tecnologia e Corporativo.
- **`executive-search`** — processos de busca executiva (C-level/board): mapeamento de mercado, abordagem confidencial, shortlist.
- **`alocacao-tech`** — staffing: matching de profissional a contrato, gestão de pool, renovação.
- **`propostas-comerciais`** — redação de proposta comercial, compartilhada pelas quatro verticais.
- **`marketing-conteudo`** — estratégia de conteúdo cross-channel e calendário editorial; decide pauta e delega aos canais.
- **`instagram`** — criação de carrosséis/legendas e automação de publicação via Meta API.
- **`linkedin`** — posts e artigos de LinkedIn (página da empresa ou thought-leadership pessoal).
- **`seo`** — otimização on-page, técnica e de conteúdo.
- **`lovable`** — prototipagem/construção do site via app builder Lovable.
- **`website`** — desenvolvimento e manutenção do código-fonte do site institucional.
- **`design-system`** — criação, governança e aplicação de tokens/componentes de UI.

## Padrões para qualquer código produzido

Estes princípios são não-negociáveis e valem para qualquer código deste workspace — principalmente `website/` e `design-system/`. As skills correspondentes (`website`, `design-system`, `seo`) aplicam estes princípios no seu contexto específico, mas a regra em si vive aqui:

- **UX/UI**: consistente com o tom sofisticado e consultivo da marca; nada de padrões genéricos de template.
- **SEO**: semântica HTML correta, meta tags, dados estruturados e performance de carregamento em qualquer página pública.
- **Acessibilidade**: tratada como requisito (WCAG), não como extra.
- **Performance**: Core Web Vitals considerados desde a implementação, não como otimização posterior.
- **Design System único**: qualquer componente visual novo nasce em `design-system/` e é reutilizado a partir dali — nunca duplique UI entre `website/`, materiais de conteúdo e outros artefatos.
