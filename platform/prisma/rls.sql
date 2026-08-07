-- Row Level Security da tabela `usuarios` — Fase 0.
--
-- Prisma Migrate não versiona RLS/policies/triggers (limitação conhecida do
-- schema.prisma) — por isso este SQL vive à parte e é aplicado manualmente
-- pelo SQL Editor do Supabase, depois de rodar `npm run db:migrate` (que
-- cria a tabela `usuarios` a partir de prisma/schema.prisma).
--
-- Ordem de setup: ver platform/README.md.

-- 1) Habilita RLS na tabela.
alter table public.usuarios enable row level security;

-- (o DEFAULT de `atualizado_em`, exigido pela trigger do item 4 que insere
-- direto via SQL fora do Prisma Client, agora vive na migration
-- 20260731115625_fix_atualizado_em_default — não precisa repetir aqui.)

-- 2) Helper SECURITY DEFINER para ler o papel do usuário autenticado sem
--    recursão de RLS (uma policy que consulta `usuarios` dentro da própria
--    policy de `usuarios` entraria em loop se não fosse por uma função
--    definer, que roda com privilégio do dono, ignorando RLS internamente).
--
--    Alternativa mais performática para fases futuras: injetar o papel como
--    custom claim no JWT via Auth Hook e trocar esta função por
--    `auth.jwt() ->> 'papel'` (é o padrão ilustrado em
--    docs/business-platform/arquitetura.md) — não implementado na Fase 0
--    para não exigir configurar Auth Hooks antes do primeiro login.
create or replace function public.current_papel()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select papel::text from public.usuarios where id = auth.uid();
$$;

-- 3) Policies.
create policy usuarios_select_own
  on public.usuarios for select
  using (id = auth.uid());

create policy usuarios_select_admin_diretoria
  on public.usuarios for select
  using (public.current_papel() in ('admin', 'diretoria'));

-- Atualização do próprio perfil (nome/avatar) é permitida; a trigger no
-- item 5 bloqueia a própria linha alterar `papel` sem ser admin.
create policy usuarios_update_own
  on public.usuarios for update
  using (id = auth.uid());

create policy usuarios_update_admin
  on public.usuarios for update
  using (public.current_papel() = 'admin');

-- 4) Sincroniza auth.users -> public.usuarios no signup. Papel começa NULO
--    de propósito — nenhum usuário novo recebe acesso por default; um admin
--    atribui o papel depois (Configurações > Usuários e papéis, Fase 1).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `atualizado_em` vai explícito (now()) em vez de depender de um DEFAULT
  -- no banco: um `prisma migrate dev` que reconcilia a tabela com o
  -- schema.prisma (onde @updatedAt não declara um DEFAULT) já derrubou esse
  -- DEFAULT sem querer mais de uma vez nesta base. Setar aqui é robusto
  -- contra isso, sem depender de nenhuma migration manual.
  insert into public.usuarios (id, nome, papel, atualizado_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    null,
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 5) Impede que alguém que não seja admin altere o próprio `papel` (evita
--    auto-promoção via a policy usuarios_update_own do item 3).
create or replace function public.prevent_self_papel_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.papel is distinct from old.papel and public.current_papel() <> 'admin' then
    raise exception 'Apenas um admin pode alterar o papel de um usuário.';
  end if;
  return new;
end;
$$;

create trigger before_usuarios_update
  before update on public.usuarios
  for each row execute function public.prevent_self_papel_change();

-- 6) Primeiro admin: depois de criar seu próprio usuário via Supabase Auth
--    (Authentication > Users > Add user, ou se cadastrando pela tela de
--    login), rode manualmente (troque o e-mail):
--
--    update public.usuarios set papel = 'admin'
--    where id = (select id from auth.users where email = 'voce@find4you.com.br');
--
--    Esse é o único momento em que um papel é atribuído sem passar pelas
--    policies acima (rodando como owner no SQL Editor) — depois disso, todo
--    novo papel é atribuído por um admin já existente.

-- ---------------------------------------------------------------------------
-- Fase 1 — CRM / Pipeline Comercial
-- ---------------------------------------------------------------------------
-- Visibilidade por papel conforme docs/business-platform/arquitetura.md —
-- simplificada aqui: "papel de CRM" (admin/diretoria/consultor_comercial) lê
-- e escreve; os demais papéis internos só leem (precisam ver empresas/
-- pipeline para outras telas); portais de cliente/candidato não têm acesso
-- nenhum a estas tabelas na Fase 1 (portais chegam na Fase 7).

create or replace function public.is_papel_crm()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() in ('admin', 'diretoria', 'consultor_comercial');
$$;

create or replace function public.is_papel_interno()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() in (
    'admin', 'diretoria', 'consultor_comercial', 'recrutador',
    'consultor_executive_search', 'financeiro'
  );
$$;

-- Fase 2 — quem trabalha o ATS (vagas/candidatos).
create or replace function public.is_papel_ats()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() in ('admin', 'diretoria', 'recrutador', 'consultor_executive_search');
$$;

-- Fase 6 — subconjunto de is_papel_ats() sem `recrutador`, pra vaga
-- confidencial (Executive Search). Ver modelagem-dados.md, seção RLS.
create or replace function public.is_papel_executive_search()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() in ('admin', 'diretoria', 'consultor_executive_search');
$$;

-- empresas / contatos: leitura para qualquer papel interno, escrita só para
-- quem trabalha o pipeline comercial.
alter table public.empresas enable row level security;
alter table public.contatos enable row level security;

create policy empresas_select on public.empresas for select using (public.is_papel_interno());
create policy empresas_write on public.empresas for all
  using (public.is_papel_crm()) with check (public.is_papel_crm());

create policy contatos_select on public.contatos for select using (public.is_papel_interno());
create policy contatos_write on public.contatos for all
  using (public.is_papel_crm()) with check (public.is_papel_crm());

-- pipelines / etapas: leitura para qualquer papel interno (precisam ver o
-- Kanban); só admin configura etapas.
alter table public.pipelines enable row level security;
alter table public.pipeline_etapas enable row level security;

create policy pipelines_select on public.pipelines for select using (public.is_papel_interno());
create policy pipelines_admin on public.pipelines for all
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');

create policy pipeline_etapas_select on public.pipeline_etapas for select using (public.is_papel_interno());
create policy pipeline_etapas_admin on public.pipeline_etapas for all
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');

-- oportunidades: papel de CRM lê/cria todas (pipeline compartilhado pelo
-- time); edição fica com o papel de CRM inteiro por ora (Fase 1 não modela
-- "time" — restringir a update só ao responsável fica para quando essa
-- necessidade aparecer de verdade).
alter table public.oportunidades enable row level security;

create policy oportunidades_select on public.oportunidades for select using (public.is_papel_crm());
create policy oportunidades_write on public.oportunidades for all
  using (public.is_papel_crm()) with check (public.is_papel_crm());

-- atividades / arquivos: polimórfica entre oportunidade (CRM) e vaga/
-- candidato (ATS, Fase 2) — leitura para qualquer papel interno, escrita
-- para quem tem papel de CRM OU de ATS (não distingue por entidade_tipo
-- aqui; refinar futuramente se precisar isolar recrutador de comercial por
-- registro específico).
alter table public.atividades enable row level security;
alter table public.arquivos enable row level security;

create policy atividades_select on public.atividades for select using (public.is_papel_interno());
create policy atividades_write on public.atividades for all
  using (public.is_papel_crm() or public.is_papel_ats()) with check (public.is_papel_crm() or public.is_papel_ats());

create policy arquivos_select on public.arquivos for select using (public.is_papel_interno());
create policy arquivos_write on public.arquivos for all
  using (public.is_papel_crm() or public.is_papel_ats()) with check (public.is_papel_crm() or public.is_papel_ats());

-- ---------------------------------------------------------------------------
-- Fase 2 — ATS / Pipeline de Vagas + Candidatos
-- ---------------------------------------------------------------------------

alter table public.vagas enable row level security;
alter table public.candidatos enable row level security;
alter table public.vaga_candidatos enable row level security;

-- Confidencial (Executive Search, Fase 6): quem só tem is_papel_ats() (ex.:
-- recrutador) não vê a linha inteira quando confidencial = true.
create policy vagas_select on public.vagas for select
  using (public.is_papel_ats() and (not confidencial or public.is_papel_executive_search()));
create policy vagas_write on public.vagas for all
  using (public.is_papel_ats() and (not confidencial or public.is_papel_executive_search()))
  with check (public.is_papel_ats() and (not confidencial or public.is_papel_executive_search()));

create policy candidatos_select on public.candidatos for select using (public.is_papel_ats());
create policy candidatos_write on public.candidatos for all
  using (public.is_papel_ats()) with check (public.is_papel_ats());

create policy vaga_candidatos_select on public.vaga_candidatos for select using (public.is_papel_ats());
create policy vaga_candidatos_write on public.vaga_candidatos for all
  using (public.is_papel_ats()) with check (public.is_papel_ats());

-- ---------------------------------------------------------------------------
-- Fase 4 — Financeiro (comissões, faturamento, regra de comissão)
-- ---------------------------------------------------------------------------

create or replace function public.is_papel_financeiro()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() in ('admin', 'financeiro');
$$;

alter table public.faturamentos enable row level security;
alter table public.comissoes enable row level security;
alter table public.regras_comissao enable row level security;

create policy faturamentos_select on public.faturamentos for select using (public.is_papel_financeiro());
create policy faturamentos_write on public.faturamentos for all
  using (public.is_papel_financeiro()) with check (public.is_papel_financeiro());

-- Comissão: financeiro vê e aprova/paga todas; o próprio usuário vê as suas
-- (transparência do quanto tem a receber), mas não edita — só financeiro/admin.
create policy comissoes_select_financeiro on public.comissoes for select using (public.is_papel_financeiro());
create policy comissoes_select_own on public.comissoes for select using (usuario_id = auth.uid());
create policy comissoes_write on public.comissoes for all
  using (public.is_papel_financeiro()) with check (public.is_papel_financeiro());

-- Regra de comissão: leitura para financeiro (precisa saber o percentual
-- aplicado), escrita só admin (é política de remuneração da empresa).
create policy regras_comissao_select on public.regras_comissao for select using (public.is_papel_financeiro());
create policy regras_comissao_admin on public.regras_comissao for all
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');

-- ---------------------------------------------------------------------------
-- Fase 5 — Automações (tarefas, notificações, engine de regras)
-- ---------------------------------------------------------------------------

-- Tarefas: mesma abertura de atividades (papel interno lê/escreve tudo —
-- é uma ferramenta de colaboração do time, não um dado sensível por pessoa).
alter table public.tarefas enable row level security;

create policy tarefas_select on public.tarefas for select using (public.is_papel_interno());
create policy tarefas_write on public.tarefas for all
  using (public.is_papel_interno()) with check (public.is_papel_interno());

-- Notificações: estritamente pessoais — só o próprio usuário vê/marca como
-- lida; admin tem acesso total como rede de segurança operacional.
alter table public.notificacoes enable row level security;

create policy notificacoes_select_own on public.notificacoes for select using (usuario_id = auth.uid());
create policy notificacoes_update_own on public.notificacoes for update using (usuario_id = auth.uid());
create policy notificacoes_admin on public.notificacoes for all
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');

-- Automações e seu histórico de execução: leitura para quem acompanha
-- operação (admin/diretoria), escrita/configuração só admin.
alter table public.automacoes enable row level security;
alter table public.automacao_execucoes enable row level security;

create policy automacoes_select on public.automacoes for select
  using (public.current_papel() in ('admin', 'diretoria'));
create policy automacoes_admin on public.automacoes for all
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');

create policy automacao_execucoes_select on public.automacao_execucoes for select
  using (public.current_papel() in ('admin', 'diretoria'));
create policy automacao_execucoes_admin on public.automacao_execucoes for all
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');

-- ---------------------------------------------------------------------------
-- Fase 6 — Verticais especializadas (Alocação Tech, Executive Search)
-- ---------------------------------------------------------------------------

-- Contratos de alocação: mesmo grupo que já trabalha o ATS (recrutador
-- monta o contrato, não é exclusivo de Executive Search).
alter table public.contratos_alocacao enable row level security;

create policy contratos_alocacao_select on public.contratos_alocacao for select using (public.is_papel_ats());
create policy contratos_alocacao_write on public.contratos_alocacao for all
  using (public.is_papel_ats()) with check (public.is_papel_ats());

-- ---------------------------------------------------------------------------
-- Fase 7 — Portais externos (Portal do Cliente, Portal do Candidato)
-- ---------------------------------------------------------------------------
-- Lembrete: como as Server Actions usam Prisma com conexão direta ao
-- Postgres (ver comentário no topo de lib/roles.ts), estas policies são rede
-- de segurança para acesso via cliente Supabase (Realtime etc.), não a
-- barreira primária dos portais — essa vive em requirePortalCliente()/
-- requirePortalCandidato() (lib/auth.ts) e nas queries de modules/portal-*.
-- Em particular, RLS aqui não distingue coluna a coluna (ex.: cliente só
-- deveria alterar feedback_cliente/comentario_cliente em vaga_candidatos,
-- nunca etapa) — essa granularidade fica só na Server Action.

create or replace function public.current_empresa_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select empresa_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.current_candidato_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select candidato_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.is_papel_cliente_portal()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() = 'cliente_portal';
$$;

create or replace function public.is_papel_candidato_portal()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_papel() = 'candidato_portal';
$$;

-- empresas/vagas: cliente_portal só vê a própria empresa e as vagas dela;
-- candidato_portal só vê vagas em que está vinculado (para mostrar
-- cargo/empresa no /portal-candidato/processo). Policies permissivas somam
-- por OR às já existentes (is_papel_interno()/is_papel_ats()) — não as troca.
create policy empresas_select_portal_cliente on public.empresas for select
  using (public.is_papel_cliente_portal() and id = public.current_empresa_id());

create policy vagas_select_portal_cliente on public.vagas for select
  using (public.is_papel_cliente_portal() and empresa_id = public.current_empresa_id());

create policy vagas_select_portal_candidato on public.vagas for select
  using (
    public.is_papel_candidato_portal()
    and id in (select vaga_id from public.vaga_candidatos where candidato_id = public.current_candidato_id())
  );

-- vaga_candidatos: cliente_portal lê a shortlist da própria empresa e pode
-- registrar feedback (aprovar/reprovar); candidato_portal só lê a própria
-- linha (nunca escreve — mudança de etapa é sempre interna).
create policy vaga_candidatos_select_portal_cliente on public.vaga_candidatos for select
  using (
    public.is_papel_cliente_portal()
    and vaga_id in (select id from public.vagas where empresa_id = public.current_empresa_id())
  );

create policy vaga_candidatos_update_portal_cliente on public.vaga_candidatos for update
  using (
    public.is_papel_cliente_portal()
    and vaga_id in (select id from public.vagas where empresa_id = public.current_empresa_id())
  )
  with check (
    public.is_papel_cliente_portal()
    and vaga_id in (select id from public.vagas where empresa_id = public.current_empresa_id())
  );

create policy vaga_candidatos_select_portal_candidato on public.vaga_candidatos for select
  using (public.is_papel_candidato_portal() and candidato_id = public.current_candidato_id());

-- candidatos: candidato_portal só lê o próprio registro; nunca escreve direto
-- (edição de perfil vira uma edicoes_perfil_pendentes para revisão).
create policy candidatos_select_portal_candidato on public.candidatos for select
  using (public.is_papel_candidato_portal() and id = public.current_candidato_id());

-- edicoes_perfil_pendentes: candidato propõe e lê as próprias; quem trabalha
-- o ATS revisa (aprova/rejeita) todas.
alter table public.edicoes_perfil_pendentes enable row level security;

create policy edicoes_perfil_select_own on public.edicoes_perfil_pendentes for select
  using (public.is_papel_candidato_portal() and candidato_id = public.current_candidato_id());
create policy edicoes_perfil_insert_own on public.edicoes_perfil_pendentes for insert
  with check (public.is_papel_candidato_portal() and candidato_id = public.current_candidato_id());

create policy edicoes_perfil_select_ats on public.edicoes_perfil_pendentes for select
  using (public.is_papel_ats());
create policy edicoes_perfil_write_ats on public.edicoes_perfil_pendentes for update
  using (public.is_papel_ats()) with check (public.is_papel_ats());

-- ---------------------------------------------------------------------------
-- Fase 10 — Metas/gamificação
-- ---------------------------------------------------------------------------

-- Metas: só admin/diretoria definem (política de remuneração/objetivos da
-- empresa); cada usuário lê a própria meta (pra ver o próprio progresso),
-- sem enxergar a dos colegas via RLS direto — o "leaderboard" da equipe é
-- uma agregação da Server Action, restrita a admin/diretoria na app layer.
alter table public.metas enable row level security;

create policy metas_select_own on public.metas for select
  using (usuario_id = auth.uid());
create policy metas_admin on public.metas for all
  using (public.current_papel() in ('admin', 'diretoria'))
  with check (public.current_papel() in ('admin', 'diretoria'));

-- ---------------------------------------------------------------------------
-- Fase 9 — Integrações por usuário (Gmail, LinkedIn, WhatsApp)
-- ---------------------------------------------------------------------------

-- Estritamente pessoal — nem admin lê o token de outra pessoa via RLS (o
-- token OAuth de um colega não é dado que a gestão precise ver; o único
-- caminho pra isso seria acesso direto ao Postgres, fora do escopo de RLS).
alter table public.integracoes_usuario enable row level security;

create policy integracoes_usuario_own on public.integracoes_usuario for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
