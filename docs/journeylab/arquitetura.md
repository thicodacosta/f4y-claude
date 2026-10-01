# JourneyLab — Plataforma multitenant de Produtos

> Escopo (28/09/2026): apenas a **aplicação autenticada** usada pelos clientes
> e pela administração do JourneyLab. O site comercial existe à parte (Claude
> Design). Substitui o planejamento "RH Lab X" (catálogo, cursos, Toolkit),
> arquivado em `historico/`. Código em `journeylab/`.

## 1. Arquitetura

| Camada | Escolha |
|---|---|
| App | Next.js 16 (App Router, Server Components/Actions), TypeScript, Tailwind v4 |
| Auth | Supabase Auth (senha, confirmação, recuperação, **convite por e-mail**) |
| Banco | Postgres (Supabase) via Prisma 7, com **RLS ativa para o papel da aplicação** |
| Arquivos | Supabase Storage, bucket privado, caminho `{tenant_id}/{modulo}/{uuid}`, download só por URL assinada emitida após checagem de permissão |
| Integrações | Webhook/conciliação (Kiwify e site próprio) → serviço único de entitlements |

Toda requisição passa por um **contexto de acesso** montado no servidor:
usuário → organização ativa (validada contra a associação) → papel →
permissões → módulos ativos. Nenhuma tela ou ação recebe `tenant_id` do
cliente.

## 2. Modelo de dados

**Plataforma (sem tenant):** `usuarios` · `organizacoes` (o tenant) ·
`produtos` (6 módulos + ids externos Kiwify/site) · `entitlements`
(org × produto: status, início, fim, origem, referência externa) ·
`historico_entitlements` · `acessos_suporte` · `eventos_integracao` ·
`auditoria`.

**Acesso por organização (`tenant_id`):** `associacoes` (usuário × org,
papel, colaborador vinculado) · `papeis` + `papel_permissoes`
(módulo × ação × escopo) · `convites` · `politicas_retencao`.

**Cadastro compartilhado (`tenant_id`):** `areas` · `equipes` (área, gestor)
· `colaboradores` (equipe, gestor, cargo, status `pre_admissao/ativo/desligado`,
usuário opcional, `candidato_origem_id` único).

**Módulos (`tenant_id` em todas as tabelas):**

```
CRM ─── candidatos ─┬─ tags · interações · anexos
                    └─ candidaturas ── vagas
        candidato "contratado" ──(ação explícita)──► colaborador ──► onboarding

Onboarding ── templates (padrão da organização | por área) → fases (marco em dias) → tarefas
              onboardings (colaborador) → fases_onboarding → tarefas (responsável, prazo, status, anexos)
              criado automaticamente no cadastro/conversão · concluído ► colaborador.status = ativo

Feedback ── avaliacoes_feedback (8 critérios de Performance + 8 de Cultura, 1–5; médias e semáforo pelo banco)
            reuniões de 1:1 (gestor × colaborador; duração, série recorrente, vínculo com o feedback)
            modelos_pauta · anotações (compartilhada | privada do autor) · compromissos ──► ação de PDI

PDI ── pdis (status e progresso CALCULADOS pelas ações) → focos (catálogo com chave estável | Outro)
       → ações (tipo, responsável, datas, status, progresso, investimento, impacto, mentor)
       comentários por ação (RH/gestor; fala do colaborador registrada por quem acompanha) · histórico

Pulse ── modelos_pulse (globais: tenant nulo · da empresa) → pesquisas → perguntas (16 tipos, config jsonb)
         audiência (todos | departamentos | equipes | pessoas) · convites (link pessoal por e-mail)
         participações (quem respondeu)  ≠  respostas (anônimas: sem pessoa nem horário)

NR-1 ── diagnósticos (completo · rápido · personalizado; questionário, escala e faixas congelados ao ativar)
        → fatores (13, severidade de referência) → perguntas (direta | reversa)
        convites (envio) ≠ usos do convite (sem data, ilegível) ≠ respostas (lote aleatório, departamento opcional)
        fatores priorizados → ações (origem humana | IA revisada, revisor, evidência)

```

Respostas de Pulse e NR-1 **não têm vínculo com a pessoa** e ficam em tabelas
que o papel da aplicação **não pode ler**; resultados saem apenas por funções
de agregação no banco que aplicam o mínimo de respondentes.

## 3. Isolamento entre organizações

1. **Servidor:** contexto de tenant resolvido da sessão; a organização ativa
   (cookie) só é aceita se houver associação ativa (ou acesso de suporte
   vigente).
2. **Consultas:** um cliente Prisma "com escopo" injeta o `tenant_id` e, a cada
   operação, define `app.tenant_id` na transação.
3. **Banco (RLS):** a aplicação conecta com um papel **sem BYPASSRLS**; toda
   tabela de tenant tem policy `tenant_id = current_setting('app.tenant_id')`.
   Um bug de código não vaza dados de outra empresa.
4. **Arquivos:** caminho prefixado pelo tenant e URL assinada curta,
   gerada só depois da checagem.
5. **Testes:** roteiro automatizado tenta ler e alterar dados da empresa B
   estando na empresa A (URL, id manipulado, ação direta) e deve falhar.

## 4. Papéis e permissões

Ações: **visualizar, criar, editar, concluir, exportar, administrar**. Cada
permissão tem **escopo**: todos · equipe · próprio. Papéis padrão (editáveis
pelo administrador da organização):

| Módulo | Admin. da organização | RH/Recrutador | Líder/Gestor | Colaborador |
|---|---|---|---|---|
| Cadastro (pessoas, equipes) | tudo | ver/criar/editar | ver (equipe) | ver (próprio) |
| CRM de Candidatos | tudo | ver/criar/editar/exportar | — | — |
| Onboarding | tudo | tudo | ver/atualizar tarefas (subordinados diretos) | — (não acessa nesta versão) |
| Feedback 1:1 | tudo* | registrar e administrar (todos)* | registrar e administrar (subordinados diretos)* | — (não acessa nesta versão) |
| Pulse | tudo | tudo (criar, enviar, encerrar, exportar) | ver resultados agregados da empresa (somente leitura) | — (responde pelo link/Início) |
| PDI | tudo (inclui excluir) | criar/ver/editar/exportar/excluir (todos) | criar/ver/editar (só liderados diretos; não exclui) | — (não acessa nesta versão) |
| Diagnóstico NR-1 | tudo | administrar (criar, ativar, enviar, encerrar, analisar, exportar) | — por padrão; se concedido (escopo equipe): agregados só das áreas que lidera | — (responde só pela página pública do convite) |

\* **Anotações de 1:1:** as *compartilhadas* são vistas só pelos dois
participantes; as *privadas* só pelo autor. Nem RH nem administrador leem
anotações por padrão, só data, status e compromissos.

**Superadmin JourneyLab:** gerencia organizações, módulos, usuários e
integrações. Não entra nos dados de uma empresa, exceto por **acesso de
suporte**: temporário, com motivo, somente leitura e auditado. Mesmo nele,
nunca vê respostas individuais de Pulse ou NR-1.

## 5. Ativação de módulos

Estados: `ativo`, `teste`, `inativo`, `suspenso`, `expirado`. Acesso liberado
se o status for `ativo` ou `teste` **e** a data atual estiver entre início e
fim (fim vazio = sem prazo).

```
Admin JourneyLab ─┐
Kiwify (webhook) ─┼─► alterarEntitlement(org, produto, status, datas, origem, responsável, motivo)
Site próprio     ─┘        │  único ponto de mudança
                           ├─ grava histórico (antes/depois, origem, quem, quando)
                           └─ nunca apaga dados do módulo
```

Compras externas (`/api/webhooks/kiwify` e `/api/webhooks/site`):

1. O evento é **gravado antes de qualquer processamento** (`eventos_integracao`).
   Kiwify: token do webhook conferido; site: assinatura HMAC-SHA256 do corpo
   (`x-journeylab-assinatura`, segredo `SITE_WEBHOOK_SECRET`).
2. É **interpretado**: tipo (aprovado, renovação, reembolso, chargeback,
   cancelamento, outro), pedido, produto externo e comprador.
3. A organização é identificada pelos **identificadores externos** cadastrados
   nela (e-mail do comprador, `@dominio` ou CNPJ). Correspondência ambígua ou
   ausente fica para revisão.
4. **Padrão: revisão manual** do superadmin (Administração › Integrações), que
   aplica o evento a uma organização com um clique. Ativação automática só com
   `INTEGRACAO_ATIVACAO_AUTOMATICA=true`, token conferido e correspondência única.
5. Efeitos via `alterarEntitlement` (origem `kiwify`/`site`, pedido como
   referência): aprovação ativa os módulos do produto pelo prazo cadastrado no
   produto externo (vazio = sem prazo); renovação estende; reembolso, chargeback
   e cancelamento **suspendem só os módulos daquele pedido**. Evento repetido do
   mesmo pedido e tipo é ignorado (idempotência).

Preços, planos e prazos não estão no código: são dados do produto externo ou
do entitlement.

## 6. Ordem de implementação

1. **Base:** projeto `journeylab/`, auth + convite, organizações, seleção e troca
   de organização, papéis e permissões, entitlements, admin JourneyLab
   (incluindo suporte e eventos), cadastro compartilhado, painel, auditoria,
   seed com 2 organizações e testes de isolamento.
2. **CRM de Candidatos** (upload, duplicidade, conversão em colaborador).
3. **Onboarding** (modelos, tarefas, conclusão → colaborador ativo).
4. **Feedback 1:1** (privacidade das anotações, compromissos).
5. **PDI** (vínculo com compromissos do 1:1).
6. **Pulse** (anonimato e mínimo de respondentes no banco).
7. **Diagnóstico NR-1** (ciclos, riscos, ações, exportação).
8. **Painel integrado, exportações, retenção de dados** e revisão final.

Situação: etapas 1 a 8 implementadas e cobertas por testes E2E
(`journeylab/scripts/e2e/`).

## 7. Privacidade aplicada no banco

| Dado | Regra | Onde |
|---|---|---|
| Anotações de 1:1 | Compartilhada: só os dois participantes. Privada: só o autor. Ninguém mais lê — nem administração, RH, plataforma ou suporte. | Policy de `anotacoes_reuniao` + `jl_participa_reuniao` |
| Respostas de Pulse e NR-1 | Sem pessoa e sem horário; a aplicação não tem permissão de leitura nem de escrita. Gravação só por `jl_registrar_resposta_pulse` / `jl_registrar_resposta_nr1` (esta, no escopo da plataforma a partir do link assinado), que validam organização, módulo, situação e prazo, público, pessoa ativa e resposta única. Pesquisa **identificada** grava a pessoa (avisada antes de responder); gatilho impede pessoa em pesquisa anônima. | `respostas_pulse`, `respostas_nr1` (sem GRANT) |
| Participação (quem respondeu) | Só a data; cada pessoa lê apenas a própria. Adesão agregada por função. | Policy `propria` |
| PDI | Leitura e escrita validadas no banco por `jl_acesso_pdi`: módulo liberado, papel com a ação, escopo "todos" ou liderado direto (`colaboradores.gestor_id`), nunca o próprio PDI do gestor; excluir só com escopo "todos"; suporte só lê. Gatilhos mantêm ação × foco do mesmo plano e progresso coerente com o status. | Policies de `pdis`, `focos_pdi`, `acoes_pdi`, `comentarios_acao_pdi`, `registros_pdi` |
| Resultados | Só por funções agregadas (`jl_resumo_pulse`, `jl_distribuicao_pulse`, `jl_comentarios_pulse`); anônimas **após o encerramento**, com mínimo de respondentes da organização (`minimo_recorte`) e **regra do complemento** em recortes por departamento/equipe (o restante da organização também precisa atingir o mínimo). Identificadas: a qualquer momento. Comentários do Pulse só em recorte liberado, em ordem aleatória. NR-1 não tem texto livre; recortes por departamento exigem público ≥ 2× o mínimo, fatores com poucas respostas ficam ocultos e as funções conferem a permissão (gestor só áreas que lidera). | `jl_resumo_*`, `jl_distribuicao_pulse`, `jl_fatores_nr1`, `jl_comentarios_pulse` |

Visualizações de resultado do NR-1 e todas as exportações ficam na auditoria.

## 8. Retenção de dados

Configurada por organização (Configurações › Retenção de dados), em meses, por
categoria: candidatos inativos, anexos do CRM, anotações de 1:1, pesquisas Pulse
encerradas e respostas brutas do NR-1. Vazio = não eliminar; não há prazo padrão.
Suspensão ou expiração de módulo **nunca** elimina dados — só a política.
Categorias que a aplicação não enxerga são eliminadas por `jl_retencao`, que lê
os prazos da própria política (não aceita prazo por parâmetro).

## 9. Rotina diária

`GET /api/cron/manutencao` com `Authorization: Bearer CRON_SECRET`: marca como
`expirado` (com histórico, origem `sistema`) o módulo cujo período terminou e
aplica a política de retenção de cada organização.

## 10. Onboarding — regras

- **Fonte única:** `lib/onboarding/calculo.ts` (funções puras: situação, progresso,
  prazo, alertas, fase atual, ritmo) e `lib/onboarding/servico.ts` (única rota de
  escrita). Botões, arrastar no Kanban e formulários chamam `mudarStatusTarefa`,
  que valida permissão, grava e roda `recalcularOnboarding` **na mesma transação**.
- **Status:** tarefas `não iniciada → em andamento → bloqueada → concluída`
  (e `dispensada`, só RH, fora do progresso). Bloquear exige motivo; bloqueada
  continua pendente. Progresso = concluídas ÷ não dispensadas. Onboarding
  conclui sozinho quando todas as obrigatórias estão concluídas e reabre se uma
  voltar a pendente. **"Não iniciado" não é gravado**: é em andamento com início
  futuro — muda quando a data chega, sem rotina agendada.
- **Prazo:** específico (quando definido) ou início + deslocamento; sem
  deslocamento, o marco da fase. Alterar a data de início recalcula os prazos
  não específicos.
- **Datas:** colunas `date` tratadas como datas civis em UTC e "hoje" no fuso
  `America/Sao_Paulo` (`lib/datas.ts`) — sem deslocamento de um dia em nenhum servidor.
- **Acesso:** RH/Admin (escopo todos); gestor só subordinados diretos e sem
  tarefas de RH; colaborador não acessa (escopo mínimo "equipe" aplicado em
  `lib/contexto.ts`, mesmo se um papel receber "próprio").
- **Criação automática:** no cadastro de pessoa e na conversão do CRM, com a
  data de admissão e o template aplicável (o da área da pessoa, senão o padrão
  30/60/90). Transação própria: falha não desfaz o cadastro e é informada.
  Um onboarding ativo por pessoa (checagem + índice único parcial).
- **Lembrete:** e-mail ao gestor direto (destinatário resolvido no servidor),
  por SMTP (`lib/email.ts`), no máximo um por hora por onboarding, auditado.

## 11. Feedback 1:1 — regras

- **Avaliação:** 8 critérios de Performance e 8 de Cultura, notas inteiras de 1 a 5,
  todas obrigatórias (CHECK no banco + validação no servidor). Média de cada
  dimensão = média dos 8; geral = média das duas. **Semáforo pela média geral:**
  verde ≥ 4,0 · amarelo ≥ 3,0 · vermelho < 3,0, sem arredondar antes de comparar.
  O gatilho `jl_calcular_avaliacao` é a fonte única (sobrescreve valores enviados);
  `lib/feedback/avaliacao.ts` usa a mesma fórmula só para a prévia. Exibição com
  uma casa decimal; status sempre com rótulo textual.
- **Acesso:** RH/Admin sobre a empresa; gestor sobre subordinados diretos
  (`colaborador.gestor_id`); colaborador não acessa (escopo mínimo "equipe").
  O gestor registrado vem do cadastro, nunca do navegador. Gatilhos garantem que
  colaborador e gestor pertencem à mesma organização do registro.
- **Cadência:** próxima data = último feedback + periodicidade dele (mensal 30,
  bimestral 60, trimestral 90; manual = sem lembrete). Sem histórico: data de
  entrada + 30 dias; sem data de entrada, nenhuma data é inventada. "Próximo" até 7
  dias antes; "atrasado" depois. Fonte única em `lib/feedback/consultas.ts`
  (página do módulo e painel).
- **Agenda:** reuniões de 1:1 reaproveitam `reunioes` (duração 15–90 min, 08h–18h
  em passos de 30 min, sem data passada). Recorrência mensal/trimestral cria a
  inicial + 3 na mesma série, numa transação; horário ativo duplicado para a mesma
  pessoa é bloqueado por índice único. Cancelar uma ocorrência não afeta as demais;
  "esta e as próximas" é ação explícita com confirmação.
- **Calendário externo:** links que abrem a criação do evento no Google Agenda ou
  no Outlook (não é sincronização). Só título e horário vão na URL.
- **PDI:** critérios com nota ≤ 2 geram prévia editável de objetivos; o PDI (ou os
  objetivos no PDI aberto) só é criado após confirmação, e só com PDI contratado.
- **IA:** não há serviço de IA configurado; o recurso aparece como indisponível.
- **Rota alternativa:** `/feedback-1on1?action=create|schedule&employee=<id>`
  redireciona para as telas do módulo, que validam o escopo do colaborador.

## 12. Pulse — regras

- **Templates:** globais (eNPS, Pulso Mensal, Clima Organizacional, Onboarding
  dia 30, Satisfação com Liderança — `lib/pulse/modelos-globais.ts`, gravados pelo
  seed com `tenant_id` nulo e legíveis por todas as organizações) e da empresa
  ("Salvar como template"). A pesquisa copia as perguntas; mudar o template não
  altera pesquisas existentes.
- **Perguntas:** 16 tipos (`lib/pulse/perguntas.ts`, fonte única de validação e
  normalização): múltipla escolha (uma/várias), lista, imagem, sim/não, NPS 0–10,
  estrelas, escala, slider, Likert, matrizes (escolha, estrelas, escala, texto),
  texto curto e longo. Perguntas só mudam em rascunho.
- **Assistente** (`/pulse/nova`, `/pesquisas?action=create`): template → perguntas
  com prévia ao vivo → configuração (anônima/identificada, audiência, datas,
  link aberto) → "Salvar rascunho" ou "Enviar agora".
- **Envio:** status "Ativa", total do público congelado, um convite por pessoa e
  e-mail white-label (logo e cor da organização — `organizacoes.logo_url`,
  `cor_marca`) com **link pessoal** `/pesquisa/responder/:id?t=<convite>.<HMAC>`
  (`PULSE_LINK_SECRET`; nada de token gravado). Falhas de envio aparecem por pessoa.
- **Resposta pública** (sem login): valida situação e prazo, identifica por link
  pessoal, sessão ou link aberto (opcional, só anônimas; duplicidade controlada
  apenas no navegador — cookie httpOnly + `localStorage`). Rascunho em
  `sessionStorage`, validação de obrigatórias, marca `survey_answered_<id>`, e o
  servidor recusa segunda resposta pela participação.
- **Resultados** (`/pulse/:id?tab=`): visão geral (participação em tempo real, dias
  restantes, evolução diária), por pergunta (recorte por departamento), eNPS
  (Excelente ≥ 50 · Bom ≥ 0 · Crítico < 0, por departamento), mapa de calor por
  departamento e Insights IA. Departamento = área da equipe.
- **Insights IA:** sob demanda ou automático ao encerrar, só com dados agregados
  (sem comentários livres nem identificação), validados e salvos em `ai_insights`.
  Sem `ANTHROPIC_API_KEY` a aba informa que a integração está indisponível.
- **Rotina diária:** encerra pesquisas vencidas e envia **um** lembrete automático a
  quem não respondeu (2 dias antes do fim; sem data de fim, 3 dias após o envio).
  Lembrete manual disponível na pesquisa.

## 13. PDI — regras

- **Status e progresso calculados** (`lib/pdi/calculo.ts`, fonte única para lista,
  Kanban, dashboard, detalhe, painel e CSV): ação concluída = 100%, em andamento =
  progresso explícito (1–99) ou 50%, não iniciada = 0%; foco = média das ações;
  PDI = média dos focos. **Concluído** exige focos, ações em todos os focos e todas
  concluídas; **Em risco** = alguma ação não concluída com prazo anterior a hoje;
  senão **Em andamento**. Não há status editável; o Kanban só visualiza.
- **Coerência no banco** (`jl_normalizar_acao_pdi`): concluir grava 100%; não iniciada
  zera; em andamento aceita 1–99. Na tela, progresso 100 conclui e 0 volta para
  não iniciada.
- **Focos:** catálogo com chaves estáveis (`lib/pdi/focos.ts`; CHECK no banco) e
  "Outro" com nome obrigatório. Sem focos repetidos no mesmo plano.
- **Fluxo guiado** (`/pdi/novo`, `/pdi?action=create`, edição em `/pdi/:id/editar`):
  colaborador e período → focos → descrição/importância/objetivo → ações → revisão.
  Nada é gravado antes da confirmação. Investimento em BRL; impacto sempre tratado
  como estimativa.
- **Feedback 1:1 → PDI** (se contratado): notas 1 e 2 (escala 1–5) sugerem focos
  (1 = prioridade crítica, 2 = atenção — organização, não rótulo), menores notas
  primeiro, sem repetição, até 3. A prévia na avaliação abre o fluxo pré-preenchido;
  o objetivo sugerido é comportamental e editável (nunca "atingir nota X").
- **Onboarding → PDI** (se contratado): na conclusão ou a partir do D+90, sugere
  criar o PDI se a pessoa ainda não tiver um. Nunca cria automaticamente.
- **Compromissos de 1:1** podem virar ação do PDI em andamento da pessoa; concluir
  a ação conclui o compromisso.
- **Alertas:** ações não concluídas vencidas ou vencendo em 7 dias aparecem no
  painel de pendências (uma linha por ação), no escopo de cada usuário.

## 14. Diagnóstico NR-1 — regras

- **Limite do produto:** instrumento de apoio ao levantamento de fatores de risco
  psicossociais relacionados ao trabalho. Scores são indicativos da pesquisa — não
  são laudo, diagnóstico clínico, certificação nem prova de conformidade, e não
  substituem a avaliação dos profissionais de SST no GRO/PGR (aviso em todas as telas,
  relatório e CSV).
- **Questionário:** biblioteca própria (`lib/nr1/questionario.ts`, não oficial do MTE)
  com 50 perguntas em 13 fatores; versão rápida com 26 (2 por fator) ou seleção
  personalizada. Escala 1 Nunca … 5 Sempre + "prefiro não responder / não se aplica".
  Cada item é **direto** ou **reverso** (positivo: 6 − resposta). Ao ativar, perguntas,
  escala, faixas, tipo, audiência e metodologia (`jl-nr1-2026.1`) ficam congelados
  por gatilho; só a severidade de referência da matriz pode ser revisada depois.
- **Cálculo** (`jl_fatores_nr1`): score do fator = arredondar(((média ajustada − 1) ÷ 4) × 100),
  maior = mais exposição; itens sem resposta não entram. Score geral = média dos
  fatores exibidos. Faixas (0–20, 21–40, 41–60, 61–80, 81–100) são critério interno
  configurável. Matriz indicativa = faixa de exposição × severidade de referência
  (1–3), com registro de quem revisou.
- **Convites de uso único sem ligação com a resposta:** o link é `id do convite + HMAC`
  (`NR1_LINK_SECRET` ou `PULSE_LINK_SECRET`, contexto próprio). `convites_nr1` guarda
  só o envio; o uso fica em `usos_convite_nr1` (sem data; a aplicação não lê); as
  respostas ficam em `respostas_nr1` com lote aleatório, sem convite, pessoa ou
  horário. A gravação é uma função atômica (uso + respostas) chamada pela página
  pública após validar a assinatura, com limite de tentativas por IP e por link.
  O RH vê só totais (elegíveis, enviados, falhas, respostas). Lembretes vão a quem
  não usou o convite sem que a lista seja exibida nem registrada por pessoa.
- **Departamento:** pergunta opcional ao respondente (nunca inferido). Recortes só
  com público ≥ 2× o mínimo, recorte ≥ mínimo e complemento ≥ mínimo; valores
  ocultos não saem do banco. Tela, relatório (PDF por impressão), CSV e IA usam a
  mesma fonte (`lib/nr1/relatorio.ts`).
- **IA** (se `ANTHROPIC_API_KEY` e `IA_MODELO` configurados): recebe só scores de
  fatores exibíveis; sugestões ficam em prévia e entram no plano apenas após
  revisão (origem "IA", revisor e data registrados).
- **Rotina diária:** encerra diagnósticos na data de fim.
- **Limitações conhecidas do anonimato:** (1) no instante da submissão o servidor
  conhece o convite (necessário para uso único) — ele não é gravado com as
  respostas; (2) quem administra o banco com superusuário pode tentar correlacionar
  pela ordem física de gravação; (3) o servidor sabe quais convites estão pendentes
  para enviar lembretes (a tela não mostra); (4) o total de respostas é atualizado
  durante a coleta; (5) grupos pequenos continuam sujeitos a inferência por contexto
  — o mínimo é piso operacional, não garantia absoluta.

## 15. Página de Carreiras (parte do CRM de Candidatos)

- **Menu e acesso:** item "Página de Carreiras" logo abaixo do CRM, com as mesmas
  permissões do CRM (visualizar/criar/editar). Não há cadastro paralelo: usa
  `vagas`, `candidatos`, `candidaturas` e `anexos_candidato`. As antigas rotas
  `/crm/vagas` redirecionam para `/pagina-carreiras`.
- **URLs públicas:** `/carreiras/{slug da organização}` e
  `/carreiras/{org}/vagas/{slug da vaga}`. O slug da vaga é gerado na criação
  (título + 6 caracteres) e não muda. Só aparecem vagas `publicada` + `aberta` de
  organizações ativas com o CRM liberado; a consulta pública seleciona apenas
  campos públicos (sem criador, e-mail, equipe, gestor ou candidaturas). Vagas
  abertas têm dados estruturados `JobPosting`.
- **Publicação:** a vaga registra o criador (usuário e e-mail). Publicar exige
  conferir o e-mail de aviso (CHECK no banco: publicada ⇒ e-mail confirmado). Vagas
  sem criador válido precisam que alguém "assuma os avisos" antes.
- **Candidatura (sem login):** nome, e-mail, telefone e currículo PDF/DOCX (até
  10 MB, validado no navegador e no servidor pela assinatura do arquivo). A
  organização vem da vaga validada no servidor. Proteções: campo-armadilha, limite
  por IP (20/10 min) e por e-mail+vaga (3/hora). O arquivo vai para o bucket
  privado (`{tenant}/crm/carreiras/...`); depois, UMA transação cria ou reaproveita
  o candidato pelo e-mail (preenche só o que faltava; diferenças vão para o
  histórico), grava o currículo, a candidatura (`origem = carreiras`) e o
  histórico. Se a transação falhar, o arquivo é removido e nada é confirmado.
  Reenvio para a mesma vaga reaproveita a candidatura e guarda o novo currículo.
- **Aviso ao criador:** e-mail com vaga, dados do candidato, data e links
  autenticados (currículo em `/crm/anexos/:id` → URL assinada de 60 s; candidato no
  CRM). O currículo não vai anexo. Só envia se o criador ainda tem acesso ativo à
  organização da vaga. Resultado gravado na candidatura (pendente/enviado/falhou,
  erro, tentativas) e reenviável no painel; falha não desfaz nem duplica nada.
- **Banco:** gatilho `jl_candidatura_consistente` garante vaga, candidato e
  currículo da mesma organização (e currículo do próprio candidato).
- **Conteúdo da página** (aba "Configurações da página", quem edita o CRM com escopo
  "todos"): capa com imagem, título e chamada; "sobre"; até 6 blocos de texto e
  imagem (lado configurável); benefícios; até 8 depoimentos com foto; galeria (até
  12 fotos); chamada para banco de talentos (aponta para uma vaga publicada); links
  oficiais (https). Guardado em `paginas_carreiras.conteudo` (JSON validado por
  `lib/carreiras/pagina.ts`; só texto simples, sem HTML; conteúdo inválido volta
  ao padrão sem quebrar a página). Seções vazias não aparecem. Logo e cor vêm do
  cadastro da organização.
- **Imagens:** JPG, PNG ou WebP até 5 MB, conferidas pela assinatura, no bucket
  privado (`{tenant}/carreiras/midia/...`) e registradas em `midias_carreiras`. A
  rota pública `/carreiras/{org}/midia/{id}` só serve imagens dessa tabela e da
  própria organização, com o tipo gravado no envio e `nosniff` (currículos nunca
  passam por ela). Ao salvar, toda imagem referenciada precisa ser da organização.

## 16. CRM — Kanban e WhatsApp

- **Kanban** (`/crm?visao=kanban`): cartões são candidaturas (candidato × vaga) em
  colunas por etapa — Inscrito, Em avaliação, Entrevista, Aprovado, Contratado,
  Não seguiu, Desistiu. Sem vaga no filtro, mostra vagas abertas ou pausadas.
  Mover (arrastar ou escolher a etapa no próprio cartão, alternativa acessível)
  chama `moverCandidatura`, que confere permissão (CRM › Editar) e o escopo do
  candidato e registra a mudança no histórico. Falha desfaz a movimentação.
- **WhatsApp:** telefones do candidato (ficha, lista, Kanban, candidaturas da vaga
  e e-mail de aviso ao criador da vaga) abrem `https://wa.me/<número>` em nova aba
  (`linkWhatsapp` em `lib/crm/normalizar.ts`: número brasileiro sem DDI recebe 55;
  número com "+" mantém o DDI informado).
- **Feedback 1:1:** o módulo não exibe mais o botão "Agendar 1:1" nem a aba
  "Compromissos". As rotas continuam existindo para links já enviados e para as
  integrações (sugestão do primeiro 1:1 no Onboarding e painel de pendências).
