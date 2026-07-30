# Mapa de Navegação

## Menu lateral (área interna — `admin`, `diretoria`, `consultor_comercial`, `recrutador`, `consultor_executive_search`, `financeiro`)

Ordem reflete frequência de uso esperada, não a ordem literal do pedido
original — Dashboard e os dois pipelines primeiro porque são o uso diário;
Configurações sempre por último por convenção.

| # | Item de menu | Rota | Visível para |
|---|---|---|---|
| 1 | Dashboard | `/dashboard` | Todos (conteúdo varia por papel, ver `fluxos-usuario.md`) |
| 2 | CRM | `/crm` | admin, diretoria, consultor_comercial |
| 3 | Pipeline Comercial | `/crm/pipeline-comercial` | admin, diretoria, consultor_comercial |
| 4 | Pipeline de Vagas | `/ats/pipeline-vagas` | admin, diretoria, recrutador, consultor_executive_search |
| 5 | Clientes | `/clientes` | admin, diretoria, consultor_comercial, financeiro |
| 6 | Empresas | `/empresas` | admin, diretoria, consultor_comercial, recrutador |
| 7 | Vagas | `/vagas` | admin, diretoria, recrutador, consultor_executive_search |
| 8 | Candidatos | `/candidatos` | admin, diretoria, recrutador, consultor_executive_search |
| 9 | Alocação de Profissionais | `/alocacao` | admin, diretoria, recrutador |
| 10 | Recrutamento & Seleção | `/recrutamento` | admin, diretoria, recrutador |
| 11 | Executive Search | `/executive-search` | admin, diretoria, consultor_executive_search |
| 12 | Agenda | `/agenda` | Todos |
| 13 | Relatórios | `/relatorios` | admin, diretoria, financeiro |
| 14 | Financeiro | `/financeiro` | admin, financeiro |
| 15 | Configurações | `/configuracoes` | admin |

**Nota sobre itens 9–11 vs. item 4.** "Pipeline de Vagas" é a visão Kanban
única do ATS; "Alocação de Profissionais", "Recrutamento & Seleção" e
"Executive Search" são recortes filtrados dessa mesma base de vagas por
vertical (mapeando exatamente as verticais de `docs/servicos/` e as skills
`alocacao-tech`, `recrutamento`, `executive-search`) — não são três ATS
diferentes. Cada um desses três itens abre o Pipeline de Vagas pré-filtrado
por vertical, mais os campos/telas específicos daquela vertical (ex.: rate e
disponibilidade de pool em Alocação; confidencialidade extra em Executive
Search).

## Rotas — área interna, expandidas

```
/dashboard
/dashboard/comercial
/dashboard/financeiro
/dashboard/recrutamento
/dashboard/diretoria
/dashboard/consultores
/dashboard/clientes

/crm/pipeline-comercial            (kanban — view padrão)
/crm/pipeline-comercial/lista
/crm/pipeline-comercial/tabela
/crm/pipeline-comercial/calendario
/crm/pipeline-comercial/timeline
/crm/oportunidades/[id]

/ats/pipeline-vagas                (kanban — view padrão)
/ats/pipeline-vagas/lista
/ats/pipeline-vagas/tabela
/ats/pipeline-vagas/calendario
/ats/pipeline-vagas/timeline

/clientes
/clientes/[id]

/empresas
/empresas/[id]

/vagas
/vagas/[id]                        (tela completa da vaga — ver wireframes.md)
/vagas/nova

/candidatos
/candidatos/[id]                   (perfil estilo LinkedIn Recruiter)
/candidatos/busca                  (busca avançada)

/alocacao                          (= /ats/pipeline-vagas?vertical=alocacao-tech)
/alocacao/pool                     (pool de talentos disponíveis)
/recrutamento                      (= /ats/pipeline-vagas?vertical=tecnologia,corporativo)
/executive-search                  (= /ats/pipeline-vagas?vertical=executive-search)
/executive-search/mapeamento       (mapeamento de mercado — ver skill executive-search)

/agenda

/relatorios
/relatorios/[dashboard-salvo]

/financeiro
/financeiro/faturamento
/financeiro/comissoes
/financeiro/receita-recorrente

/configuracoes
/configuracoes/pipelines           (editor de etapas — ver wireframes.md)
/configuracoes/automacoes
/configuracoes/usuarios-papeis
/configuracoes/integracoes
```

## Portal do Cliente (papel `cliente_portal`)

Aplicação restrita, mesmo domínio, layout distinto (sem menu lateral completo
— navegação simplificada em topo):

```
/portal-cliente/vagas                       (só vagas da própria empresa)
/portal-cliente/vagas/[id]                  (status, shortlist, timeline pública)
/portal-cliente/shortlist/[id]/feedback     (aprovar/reprovar candidato, comentar)
```

## Portal do Candidato (papel `candidato_portal`)

```
/portal-candidato/processo                  (status do próprio processo seletivo)
/portal-candidato/perfil                    (editar próprios dados/currículo)
/portal-candidato/documentos
```

## Navegação global (presente em todas as áreas internas)

- **Command palette** (`Cmd/Ctrl+K`) — busca universal (cliente, vaga,
  candidato, oportunidade) + ações rápidas ("criar vaga", "nova oportunidade").
- **Barra de notificações** — realtime, alimentada pela engine de automação.
- **Seletor de filtros globais** persistente no Dashboard e Relatórios (mês,
  ano, consultor, empresa, origem, serviço, status, segmento, responsável,
  valor — mesma lista de filtros pedida para o Pipeline Comercial, reutilizada).
