# Wireframes — Telas Principais

Spec de layout, não visual final (cores/tipografia/espaçamento vêm de
`design-system.md` + `design-system/`). Um mockup navegável de alta fidelidade
do Dashboard existe como Artifact separado (ver conversa) para validar o
nível visual antes da implementação; este documento cobre a estrutura de
todas as telas-chave em texto, no mesmo formato usado em
`docs/website/pages/`.

## Shell da aplicação (presente em toda tela interna)

```
┌──────────┬──────────────────────────────────────────────────┐
│          │  Topbar: breadcrumb · busca (Cmd+K) · notificações │
│  Sidebar │  · avatar/menu de conta                            │
│  (menu   ├──────────────────────────────────────────────────┤
│  lateral,│                                                    │
│  colapsá-│               Conteúdo da página                  │
│  vel)    │                                                    │
│          │                                                    │
└──────────┴──────────────────────────────────────────────────┘
```

Sidebar colapsa para ícones apenas (hover expande); estado persiste por
usuário. Dark mode é um toggle na conta, não uma preferência só de sistema.

## 1. Dashboard Principal

```
┌─────────────────────────────────────────────────────────────┐
│ Filtros globais: [Mês ▾] [Ano ▾] [Consultor ▾] [Segmento ▾]  │
├─────────────────────────────────────────────────────────────┤
│ Linha 1 — KPIs financeiros (cards, 6 por linha, responsivo)   │
│ Receita Mês | Receita Ano | Meta | Forecast | Ticket Médio |  │
│ Receita Recorrente                                            │
├─────────────────────────────────────────────────────────────┤
│ Linha 2 — KPIs operacionais                                   │
│ Vagas Abertas | Vagas Fechadas | Taxa Conversão | Tempo Médio │
│ Fechamento | Alocados | Hunting                               │
├─────────────────────────────────────────────────────────────┤
│ Linha 3 — KPIs de relacionamento                              │
│ Clientes Ativos | Clientes Inativos | Novos Clientes | NPS |  │
│ SLA | Comissões                                                │
├───────────────────────────┬───────────────────────────────────┤
│ Funil Comercial (gráfico)  │ Funil de Recrutamento (gráfico)   │
├───────────────────────────┼───────────────────────────────────┤
│ Receita Mensal (linha)     │ Pipeline x Forecast (barras)       │
├───────────────────────────┴───────────────────────────────────┤
│ Receita por Cliente | Receita por Serviço (barras horizontais) │
├─────────────────────────────────────────────────────────────┤
│ Heatmap de atividade (dia x consultor)                        │
├───────────────────────────┬───────────────────────────────────┤
│ Top Clientes / Top Empresas│ Top Consultores / Top Recrutadores│
│ (ranking, tabs)             │ Top Tecnologias (tags por volume) │
└───────────────────────────┴───────────────────────────────────┘
```

Cada card de KPI: valor grande, variação vs. período anterior (▲/▼ com cor
semântica), sparkline opcional. Cada gráfico tem botão "salvar visualização"
e "exportar" (PDF/Excel). Widgets são arrastáveis (dnd-kit) — layout salvo
por usuário em `dashboard_layouts` (ver `modelagem-dados.md`).

## 2. Pipeline Comercial — Kanban

```
┌─────────────────────────────────────────────────────────────┐
│ [Kanban] [Lista] [Tabela] [Calendário] [Timeline]   + Nova    │
│ Filtros: Mês·Ano·Consultor·Empresa·Origem·Serviço·Status·...  │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│ Lead   │Contato │Qualif. │Diagn.  │Proposta│Negoc.  │Fecham. │
│ (N)    │ (N)    │ (N)    │ (N)    │ (N)    │ (N)    │ (N)    │
│        │        │        │        │        │        │        │
│ [card] │ [card] │ [card] │ [card] │ [card] │ [card] │ [card] │
│ [card] │ [card] │        │ [card] │        │        │        │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┘
```

Card: nome da empresa, contato, valor estimado, probabilidade (barra), avatar
do responsável, badge de origem, indicador de SLA estourado (borda vermelha).
Coluna: header editável (nome, cor) só para `admin`, contador + soma de
valor da coluna. "Ganho" e "Perdido" são colunas fixas ao final, fora da
ordem reordenável.

**Painel do card** (abre em drawer lateral ao clicar, sem sair do Kanban):
tabs Detalhes / Atividades / Arquivos / Histórico. Campos conforme
`modelagem-dados.md#oportunidades`.

## 3. Pipeline de Vagas (ATS) — Kanban

Mesma estrutura de shell do Pipeline Comercial. Etapas padrão: Abertas →
Análise RH → CV Enviado → Entrevista Cliente → Forecast → Fechada/Perdida —
mas aqui o card do Kanban principal representa a **vaga**; dentro da vaga
existe um segundo Kanban (por candidato) na tela de detalhe.

Card de vaga: cargo, cliente, consultor + recrutador (dois avatares),
quantidade de posições (badge "2/3 preenchidas"), prioridade (cor lateral),
tags de tecnologia, SLA.

## 3.1 Tela completa da Vaga (`/vagas/[id]`)

```
┌─────────────────────────────────────────────────────────────┐
│ ← Voltar   Cargo · Cliente          [Editar] [⋮ mais ações]  │
├───────────────────────────┬───────────────────────────────────┤
│ Coluna principal (70%)     │ Coluna lateral (30%)               │
│                             │                                     │
│ Tabs: Descrição / JD /      │ Empresa · Gestor · Contato          │
│ Skills / Checklist /        │ Salário · Benefícios                │
│ Comentários / Atividades    │ Modelo: Remoto/Híbrido/Presencial   │
│                             │ Cidade · Estado                     │
│ Kanban interno de           │ Senioridade · Stack Tecnológica     │
│ candidatos desta vaga:      │ Status · Prioridade · Tags          │
│ Abertas→Análise RH→CV       │                                     │
│ Enviado→Entrevista→         │ Timeline (histórico completo)       │
│ Forecast→Fechada/Perdida    │ Arquivos                            │
└───────────────────────────┴───────────────────────────────────┘
```

## 4. Candidatos — Lista e Perfil

**Lista** (`/candidatos`): grid de cards estilo LinkedIn Recruiter — foto,
nome, cargo atual, empresa atual, cidade, tags de skill/tecnologia, score
(badge circular), status (disponível/em processo/alocado/inativo). Busca
avançada com filtros combináveis (skill, empresa, cargo, cidade, tecnologia,
idioma, certificação, disponibilidade, salário) numa barra lateral
recolhível, resultados atualizando sem reload.

**Perfil** (`/candidatos/[id]`):

```
┌─────────────────────────────────────────────────────────────┐
│ Foto · Nome · Cargo · Empresa Atual        [Score] [Fit ▾]   │
│ 📞 💬 ✉ 🔗LinkedIn 🐙GitHub 🌐Portfólio                       │
├───────────────────────────┬───────────────────────────────────┤
│ Tabs: Experiência /        │ Skills / Tecnologias (tags)         │
│ Formação / Certificações   │ Idiomas                             │
│                             │ Pretensão salarial                 │
│                             │ Disponibilidade                     │
│                             │ Documentos (currículo, portfólio)   │
├───────────────────────────┴───────────────────────────────────┤
│ Histórico / Observações / Processos seletivos (atuais e passados) │
└─────────────────────────────────────────────────────────────┘
```

Botão "Resumir currículo com IA" gera um parágrafo de síntese acima da tab
Experiência (ver `diferenciais.md`).

## 5. Forecast

```
┌─────────────────────────────────────────────────────────────┐
│ Receita Prevista | Confirmada | Perdida | Meta | Gap          │
├─────────────────────────────────────────────────────────────┤
│ Pipeline Coverage (gauge)  │ Conversão (funil)                 │
├─────────────────────────────────────────────────────────────┤
│ Receita por mês (linha, real vs. previsto vs. meta)           │
├─────────────────────────────────────────────────────────────┤
│ Receita por consultor | Receita por cliente (tabelas ordenáveis)│
└─────────────────────────────────────────────────────────────┘
```

Cada linha de oportunidade "aberta" contribui ao Forecast ponderada pela
probabilidade da etapa atual (editável por admin em
`/configuracoes/pipelines`), igual ao modelo de forecast do Salesforce.

## 6. Configurações → Editor de Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Pipeline: [Comercial ▾]                        + Nova etapa  │
├─────────────────────────────────────────────────────────────┤
│ ⠿ Lead        cor ■  SLA: 2d   prob: 10%   [editar] [excluir]│
│ ⠿ Contato     cor ■  SLA: 3d   prob: 20%   [editar] [excluir]│
│ ⠿ Qualificação...                                             │
│ ...                                                            │
├─────────────────────────────────────────────────────────────┤
│ Automações desta etapa: [+ adicionar regra]                   │
│   Ao entrar → [criar tarefa ▾] [notificar ▾] [mover se... ▾]  │
└─────────────────────────────────────────────────────────────┘
```

Arrastar (⠿) reordena etapas. Excluir etapa com cards existentes exige
escolher etapa de destino antes de confirmar (ver fluxo 9 em
`fluxos-usuario.md`).
