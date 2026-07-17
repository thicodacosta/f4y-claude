# Automations

Scripts executáveis e configuração de integração, por ferramenta. Esta pasta
**não** documenta procedimento — fluxo, checklist e troubleshooting de cada
automação vivem na skill correspondente (ex.: `instagram`), seguindo a regra
de "cada informação tem um único dono" do `CLAUDE.md` raiz. Cada
`automations/<ferramenta>/README.md` só aponta para a skill dona e lista o que
está de fato implementado naquela pasta (scripts, `.env.example`).

## Convenção por pasta

- `README.md` — o que existe implementado ali + qual skill é dona do
  procedimento (ou nota de que a automação ainda não foi construída).
- Scripts e `.env.example`, quando existirem.
- Nunca duplicar aqui o fluxo/checklist/troubleshooting já documentado em uma
  SKILL.md.

## Ferramentas

| Pasta | Status | Skill dona do procedimento |
|---|---|---|
| `instagram/` | Implementado (publicação via Meta API) | `instagram` |
| `linkedin/` | Não implementado — skill cobre só criação de conteúdo, não automação de publicação | `linkedin` (parcial) |
| `lovable/` | Acesso via conector MCP da Claude, sem script próprio | `lovable` |
| `whatsapp/` | Não implementado | — |
| `email/` | Não implementado | — |
| `crm/` | Não implementado | — |
| `n8n/` | Não implementado | — |
| `make/` | Não implementado | — |
| `apollo/` | Não implementado | — |
| `zoho/` | Não implementado | — |
| `claude/` | Escopo não definido | — |

Para qualquer pasta "Não implementado": não inventar fluxo, credencial ou
integração. Ao ser construída, o procedimento nasce em uma skill nova ou numa
existente, e esta pasta passa a guardar só o que for específico da integração.
