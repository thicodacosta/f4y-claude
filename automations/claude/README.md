# Automation — Claude

Integrações que chamam a API do Claude (Anthropic) diretamente, fora do
Claude Code. O Claude Code em si opera o workspace via `.claude/skills/` e
não mora aqui.

| Pasta | O que é | Skill dona do procedimento |
|---|---|---|
| `extensao-entrevistas/` | Extensão Chrome JourneyLab: registro de entrevistas, currículos padronizados, comparativo de candidatos, pesquisa salarial, turnover, prompts e Shortlist no LinkedIn | `recrutamento` |
| `extensao-bp/` | Extensão Chrome JourneyLab · BP: Onboarding, Produtividade, Cultura, Turnover, Pulso (link público), Offboarding, Gestão preditiva e Chat, com PDF e Motion em cada funcionalidade. Reaproveita login, IA, PDF e Chat da `extensao-entrevistas/` | `business-platform` |
