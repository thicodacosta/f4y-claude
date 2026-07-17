# Find4You — Workspace Operacional

Workspace do Claude Code para toda a operação da Find4You, consultoria de
Recruitment & Executive Search. Ponto de entrada rápido — a documentação
completa vive em `.claude/CLAUDE.md`.

## Por onde começar

- **Regras de negócio, tom de marca e índice de skills:** `.claude/CLAUDE.md`
- **Procedimentos operacionais por área:** `.claude/skills/<nome>/SKILL.md`
- **Base de conhecimento factual:** `docs/`
- **Templates de conteúdo:** `prompts/`

## Estrutura

```
.claude/skills/    procedimentos por área (recrutamento, marketing, site...)
docs/               conhecimento factual: marca, metodologia, processos, serviços, clientes
prompts/            templates reutilizáveis por tipo de conteúdo
design-system/      fonte única de verdade de tokens/componentes de UI
website/            código-fonte do site institucional
automations/        scripts executáveis (ex.: publicação em redes sociais)
```

## Regra de ouro

Cada informação tem um único dono. Antes de criar conteúdo novo, verifique se
já existe um doc, prompt ou componente equivalente — nunca duplique. Ver
"Como este workspace é organizado" em `.claude/CLAUDE.md` para o mapa completo.
