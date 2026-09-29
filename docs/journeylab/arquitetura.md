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

Feedback ── modelos_pauta · reuniões (gestor × colaborador)
            anotações (compartilhada | privada do autor) · compromissos ──► ação de PDI

PDI ── pdis (rascunho/ativo/concluído/arquivado) → objetivos → ações
       evidências · revisões · comentários

Pulse ── pesquisas → perguntas · público
         participações (quem respondeu)  ≠  respostas (anônimas, sem pessoa)

NR-1 ── ciclos → dimensões → perguntas · público
        participações  ≠  respostas (anônimas) · riscos → ações
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
| Feedback 1:1 | administrar* | ver metadados e compromissos | criar/editar (equipe) | ver/concluir (próprio) |
| Pulse | tudo | criar/ver agregados | ver agregados (equipe, se ≥ mínimo) | responder |
| PDI | tudo | ver/editar | criar/editar (equipe) | ver/editar (próprio) |
| Diagnóstico NR-1 | administrar | — (só se concedido) | — | responder |

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
| Respostas de Pulse e NR-1 | Sem pessoa e sem horário; a aplicação não tem permissão de leitura nem de escrita. Gravação só por `jl_responder_pulse` / `jl_responder_nr1`, que validam organização, módulo, público, pessoa ativa e resposta única. | `respostas_pulse`, `respostas_nr1` (sem GRANT) |
| Participação (quem respondeu) | Só a data; cada pessoa lê apenas a própria. Adesão agregada por função. | Policy `propria` |
| Resultados | Só por funções agregadas, **após o encerramento**, com mínimo de respondentes da organização (`minimo_recorte`) e **regra do complemento** em recortes por equipe (o restante da organização também precisa atingir o mínimo). Comentários do Pulse só em recorte liberado, em ordem aleatória. NR-1 não tem texto livre. | `jl_resumo_*`, `jl_resultado_*`, `jl_comentarios_pulse` |

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
