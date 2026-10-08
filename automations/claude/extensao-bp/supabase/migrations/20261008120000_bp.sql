-- JourneyLab · BP — base de dados da extensão.
--
-- Tudo é isolado por empresa: cada conta (Supabase Auth, as mesmas da
-- ToolsKit) pertence a uma ou mais empresas em bp_membros, e as políticas RLS
-- só liberam linhas dessas empresas. O histórico de cada colaborador
-- (bp_historico) é escrito por gatilhos, para nunca depender da interface.
--
-- As únicas portas sem login são bp_pesquisa_publica e bp_responder_pesquisa,
-- usadas pela página pública das pesquisas (link com token).

-- ─── Empresas e membros ─────────────────────────────────────────────────────

create table public.bp_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 160),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.bp_membros (
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null default 'admin' check (papel in ('admin', 'rh', 'gestor')),
  criado_em timestamptz not null default now(),
  primary key (empresa_id, user_id)
);
create index bp_membros_user_idx on public.bp_membros (user_id);

-- Empresas da conta logada. SECURITY DEFINER evita recursão nas políticas.
create function public.bp_minhas_empresas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select empresa_id from public.bp_membros where user_id = (select auth.uid())
$$;

-- Primeira entrada: cria a empresa da conta (ou devolve a que já existe).
create function public.bp_garantir_empresa(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'sem_sessao';
  end if;
  select m.empresa_id into v_id
    from public.bp_membros m
   where m.user_id = (select auth.uid())
   order by m.criado_em
   limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.bp_empresas (nome, criado_por)
  values (coalesce(nullif(trim(p_nome), ''), 'Minha empresa'), (select auth.uid()))
  returning id into v_id;
  insert into public.bp_membros (empresa_id, user_id, papel) values (v_id, (select auth.uid()), 'admin');
  return v_id;
end;
$$;

-- ─── Colaboradores ──────────────────────────────────────────────────────────

create table public.bp_colaboradores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 160),
  email text check (email is null or char_length(email) <= 254),
  cargo text,
  area text,
  gestor text,
  vinculo text not null default 'clt' check (vinculo in ('clt', 'pj', 'estagio', 'outro')),
  salario numeric(12, 2) check (salario is null or salario >= 0),
  admissao date,
  desligamento date,
  status text not null default 'ativo' check (status in ('ativo', 'desligado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index bp_colaboradores_empresa_idx on public.bp_colaboradores (empresa_id, status);
create unique index bp_colaboradores_email_idx on public.bp_colaboradores (empresa_id, lower(email)) where email is not null;

-- ─── Onboarding (30/60/90) ──────────────────────────────────────────────────

create table public.bp_onboardings (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  colaborador_id uuid not null references public.bp_colaboradores (id) on delete cascade,
  inicio date not null,
  fases jsonb not null,
  progresso smallint not null default 0 check (progresso between 0 and 100),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido', 'cancelado')),
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index bp_onboardings_empresa_idx on public.bp_onboardings (empresa_id, status);
create index bp_onboardings_colab_idx on public.bp_onboardings (colaborador_id);

-- ─── Avaliações: Produtividade e Cultura ────────────────────────────────────

create table public.bp_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  colaborador_id uuid not null references public.bp_colaboradores (id) on delete cascade,
  dimensao text not null check (dimensao in ('produtividade', 'cultura')),
  data date not null default current_date,
  notas jsonb not null,
  media numeric(3, 2) not null check (media between 1 and 5),
  comentario text,
  avaliador text,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index bp_avaliacoes_empresa_idx on public.bp_avaliacoes (empresa_id, dimensao, data desc);
create index bp_avaliacoes_colab_idx on public.bp_avaliacoes (colaborador_id, dimensao, data desc);

-- ─── Pesquisas (Pulso e entrevista de desligamento) ─────────────────────────

create table public.bp_pesquisas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  tipo text not null check (tipo in ('engajamento15', 'bemestar15', 'clima30', 'lideranca30', 'personalizada', 'offboarding')),
  titulo text not null check (char_length(titulo) between 1 and 200),
  descricao text,
  perguntas jsonb not null,
  anonima boolean not null default true,
  -- 64 caracteres hexadecimais de duas UUID v4 (≈ 244 bits aleatórios).
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status text not null default 'aberta' check (status in ('aberta', 'encerrada')),
  encerra_em date,
  colaborador_id uuid references public.bp_colaboradores (id) on delete cascade,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index bp_pesquisas_empresa_idx on public.bp_pesquisas (empresa_id, tipo, criado_em desc);

create table public.bp_respostas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.bp_pesquisas (id) on delete cascade,
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  colaborador_id uuid references public.bp_colaboradores (id) on delete set null,
  nome text,
  email text,
  area text,
  respostas jsonb not null,
  criado_em timestamptz not null default now()
);
create index bp_respostas_pesquisa_idx on public.bp_respostas (pesquisa_id, criado_em);
create index bp_respostas_empresa_idx on public.bp_respostas (empresa_id);

-- ─── Desligamentos (Offboarding e Turnover) ─────────────────────────────────

create table public.bp_desligamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  colaborador_id uuid not null references public.bp_colaboradores (id) on delete cascade,
  data date not null,
  tipo text not null,
  voluntario boolean not null,
  motivo text,
  lamentada boolean not null default false,
  custo numeric(14, 2),
  custo_detalhe jsonb,
  checklist jsonb,
  observacoes text,
  pesquisa_id uuid references public.bp_pesquisas (id) on delete set null,
  entrevista jsonb,
  entrevista_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index bp_desligamentos_empresa_idx on public.bp_desligamentos (empresa_id, data desc);
create index bp_desligamentos_colab_idx on public.bp_desligamentos (colaborador_id);

-- ─── Documentos gerados (Motion, análises de IA, PDFs) e conversas ──────────

create table public.bp_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  colaborador_id uuid references public.bp_colaboradores (id) on delete cascade,
  tipo text not null check (tipo in ('motion', 'analise', 'pdf')),
  modulo text not null,
  titulo text not null,
  conteudo jsonb not null default '{}'::jsonb,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index bp_documentos_empresa_idx on public.bp_documentos (empresa_id, tipo, criado_em desc);

create table public.bp_conversas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default 'Conversa',
  mensagens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index bp_conversas_user_idx on public.bp_conversas (empresa_id, user_id, atualizado_em desc);

-- ─── Histórico (linha do tempo de cada colaborador e da empresa) ────────────

create table public.bp_historico (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.bp_empresas (id) on delete cascade,
  colaborador_id uuid references public.bp_colaboradores (id) on delete cascade,
  modulo text not null,
  evento text not null,
  resumo text not null,
  dados jsonb,
  autor uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index bp_historico_colab_idx on public.bp_historico (colaborador_id, criado_em desc);
create index bp_historico_empresa_idx on public.bp_historico (empresa_id, criado_em desc);

-- ─── atualizado_em ──────────────────────────────────────────────────────────

create function public.bp_tocar_atualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger bp_colaboradores_atualizado before update on public.bp_colaboradores for each row execute function public.bp_tocar_atualizado();
create trigger bp_onboardings_atualizado before update on public.bp_onboardings for each row execute function public.bp_tocar_atualizado();
create trigger bp_desligamentos_atualizado before update on public.bp_desligamentos for each row execute function public.bp_tocar_atualizado();
create trigger bp_conversas_atualizado before update on public.bp_conversas for each row execute function public.bp_tocar_atualizado();

-- ─── Gatilhos de histórico ──────────────────────────────────────────────────

create function public.bp_registrar(p_empresa uuid, p_colab uuid, p_modulo text, p_evento text, p_resumo text, p_dados jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.bp_historico (empresa_id, colaborador_id, modulo, evento, resumo, dados)
  values (p_empresa, p_colab, p_modulo, p_evento, p_resumo, p_dados)
$$;
revoke execute on function public.bp_registrar(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

create function public.bp_hist_colaborador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mudancas text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform public.bp_registrar(new.empresa_id, new.id, 'pessoas', 'cadastro',
      'Cadastro' || coalesce(' como ' || new.cargo, '') || coalesce(' · ' || new.area, ''),
      jsonb_build_object('cargo', new.cargo, 'area', new.area, 'admissao', new.admissao));
    return new;
  end if;
  if new.cargo is distinct from old.cargo then mudancas := mudancas || ('cargo: ' || coalesce(old.cargo, '—') || ' → ' || coalesce(new.cargo, '—')); end if;
  if new.area is distinct from old.area then mudancas := mudancas || ('área: ' || coalesce(old.area, '—') || ' → ' || coalesce(new.area, '—')); end if;
  if new.gestor is distinct from old.gestor then mudancas := mudancas || ('gestor: ' || coalesce(old.gestor, '—') || ' → ' || coalesce(new.gestor, '—')); end if;
  if new.salario is distinct from old.salario then mudancas := mudancas || 'remuneração atualizada'::text; end if;
  if new.status is distinct from old.status then mudancas := mudancas || ('status: ' || old.status || ' → ' || new.status); end if;
  if array_length(mudancas, 1) > 0 then
    perform public.bp_registrar(new.empresa_id, new.id, 'pessoas', 'alteracao',
      'Cadastro alterado (' || array_to_string(mudancas, '; ') || ')', null);
  end if;
  return new;
end;
$$;
create trigger bp_colaboradores_hist after insert or update on public.bp_colaboradores for each row execute function public.bp_hist_colaborador();

create function public.bp_hist_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'onboarding', 'inicio',
      'Onboarding 30/60/90 iniciado em ' || to_char(new.inicio, 'DD/MM/YYYY'), null);
  elsif new.status is distinct from old.status then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'onboarding', new.status,
      case new.status when 'concluido' then 'Onboarding concluído' when 'cancelado' then 'Onboarding cancelado' else 'Onboarding reaberto' end,
      jsonb_build_object('progresso', new.progresso));
  elsif new.progresso >= old.progresso + 25 or (new.progresso / 25) > (old.progresso / 25) then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'onboarding', 'progresso',
      'Onboarding em ' || new.progresso || '%', jsonb_build_object('progresso', new.progresso));
  end if;
  return new;
end;
$$;
create trigger bp_onboardings_hist after insert or update on public.bp_onboardings for each row execute function public.bp_hist_onboarding();

create function public.bp_hist_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bp_registrar(new.empresa_id, new.colaborador_id, new.dimensao, 'avaliacao',
    'Avaliação de ' || case new.dimensao when 'produtividade' then 'Produtividade' else 'Cultura' end
      || ': média ' || replace(to_char(new.media, 'FM0.0'), '.', ','),
    jsonb_build_object('avaliacao_id', new.id, 'media', new.media, 'data', new.data));
  return new;
end;
$$;
create trigger bp_avaliacoes_hist after insert on public.bp_avaliacoes for each row execute function public.bp_hist_avaliacao();

create function public.bp_hist_desligamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- O desligamento muda o cadastro (status e data), o que também entra no histórico.
    update public.bp_colaboradores set status = 'desligado', desligamento = new.data where id = new.colaborador_id;
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'offboarding', 'desligamento',
      'Desligamento registrado em ' || to_char(new.data, 'DD/MM/YYYY') || case when new.voluntario then ' (voluntário)' else ' (involuntário)' end,
      jsonb_build_object('tipo', new.tipo, 'motivo', new.motivo, 'custo', new.custo));
  elsif new.entrevista is not null and old.entrevista is null then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'offboarding', 'entrevista',
      'Entrevista de desligamento respondida', null);
  end if;
  return new;
end;
$$;
create trigger bp_desligamentos_hist after insert or update on public.bp_desligamentos for each row execute function public.bp_hist_desligamento();

-- Excluir um desligamento devolve a pessoa ao quadro ativo. Quando a exclusão
-- vem em cascata (a pessoa ou a empresa foi excluída), não há o que desfazer.
create function public.bp_desfazer_desligamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.bp_colaboradores where id = old.colaborador_id) then
    return old;
  end if;
  update public.bp_colaboradores set status = 'ativo', desligamento = null where id = old.colaborador_id;
  perform public.bp_registrar(old.empresa_id, old.colaborador_id, 'offboarding', 'desfeito', 'Registro de desligamento excluído', null);
  return old;
end;
$$;
create trigger bp_desligamentos_desfazer after delete on public.bp_desligamentos for each row execute function public.bp_desfazer_desligamento();

create function public.bp_hist_resposta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo text;
  v_tipo text;
begin
  select titulo, tipo into v_titulo, v_tipo from public.bp_pesquisas where id = new.pesquisa_id;
  if v_tipo = 'offboarding' then
    update public.bp_desligamentos
       set entrevista = new.respostas, entrevista_em = now()
     where pesquisa_id = new.pesquisa_id and entrevista is null;
  elsif new.colaborador_id is not null then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'pulso', 'resposta',
      'Respondeu à pesquisa "' || v_titulo || '"', jsonb_build_object('pesquisa_id', new.pesquisa_id));
  end if;
  return new;
end;
$$;
create trigger bp_respostas_hist after insert on public.bp_respostas for each row execute function public.bp_hist_resposta();

create function public.bp_hist_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.colaborador_id is not null then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, new.modulo, new.tipo,
      case new.tipo when 'motion' then 'Motion gerado: ' when 'analise' then 'Análise gerada: ' else 'PDF gerado: ' end || new.titulo, null);
  end if;
  return new;
end;
$$;
create trigger bp_documentos_hist after insert on public.bp_documentos for each row execute function public.bp_hist_documento();

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.bp_empresas enable row level security;
alter table public.bp_membros enable row level security;
alter table public.bp_colaboradores enable row level security;
alter table public.bp_onboardings enable row level security;
alter table public.bp_avaliacoes enable row level security;
alter table public.bp_pesquisas enable row level security;
alter table public.bp_respostas enable row level security;
alter table public.bp_desligamentos enable row level security;
alter table public.bp_documentos enable row level security;
alter table public.bp_conversas enable row level security;
alter table public.bp_historico enable row level security;

create policy bp_empresas_ler on public.bp_empresas for select to authenticated
  using (id in (select public.bp_minhas_empresas()));
create policy bp_empresas_editar on public.bp_empresas for update to authenticated
  using (id in (select public.bp_minhas_empresas())) with check (id in (select public.bp_minhas_empresas()));

create policy bp_membros_ler on public.bp_membros for select to authenticated
  using (empresa_id in (select public.bp_minhas_empresas()));

-- Mesma regra para as tabelas de dados: só a(s) empresa(s) da conta.
do $$
declare
  t text;
begin
  foreach t in array array['bp_colaboradores', 'bp_onboardings', 'bp_avaliacoes', 'bp_pesquisas', 'bp_desligamentos', 'bp_documentos'] loop
    execute format('create policy %1$s_empresa on public.%1$s for all to authenticated
      using (empresa_id in (select public.bp_minhas_empresas()))
      with check (empresa_id in (select public.bp_minhas_empresas()))', t);
  end loop;
end;
$$;

-- Respostas chegam só pela função pública; a equipe lê e pode excluir.
create policy bp_respostas_ler on public.bp_respostas for select to authenticated
  using (empresa_id in (select public.bp_minhas_empresas()));
create policy bp_respostas_excluir on public.bp_respostas for delete to authenticated
  using (empresa_id in (select public.bp_minhas_empresas()));

-- Histórico: escrito pelos gatilhos; a equipe lê e acrescenta anotações.
create policy bp_historico_ler on public.bp_historico for select to authenticated
  using (empresa_id in (select public.bp_minhas_empresas()));
create policy bp_historico_anotar on public.bp_historico for insert to authenticated
  with check (empresa_id in (select public.bp_minhas_empresas()) and modulo = 'anotacao');

-- Conversas do Chat são pessoais.
create policy bp_conversas_dono on public.bp_conversas for all to authenticated
  using (user_id = (select auth.uid()) and empresa_id in (select public.bp_minhas_empresas()))
  with check (user_id = (select auth.uid()) and empresa_id in (select public.bp_minhas_empresas()));

-- Nada das tabelas do BP fica aberto sem login (só as duas funções abaixo).
revoke all on
  public.bp_empresas, public.bp_membros, public.bp_colaboradores, public.bp_onboardings, public.bp_avaliacoes,
  public.bp_pesquisas, public.bp_respostas, public.bp_desligamentos, public.bp_documentos, public.bp_conversas, public.bp_historico
  from anon;
grant select, insert, update, delete on
  public.bp_empresas, public.bp_membros, public.bp_colaboradores, public.bp_onboardings, public.bp_avaliacoes,
  public.bp_pesquisas, public.bp_respostas, public.bp_desligamentos, public.bp_documentos, public.bp_conversas, public.bp_historico
  to authenticated;
-- Rotinas administrativas (painel do Supabase, scripts com a chave secreta).
grant all on
  public.bp_empresas, public.bp_membros, public.bp_colaboradores, public.bp_onboardings, public.bp_avaliacoes,
  public.bp_pesquisas, public.bp_respostas, public.bp_desligamentos, public.bp_documentos, public.bp_conversas, public.bp_historico
  to service_role;

-- ─── Página pública da pesquisa ─────────────────────────────────────────────

-- Dados para responder: só o necessário (sem respostas, sem dados de outras pessoas).
create function public.bp_pesquisa_publica(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select p.*, e.nome as empresa, c.nome as colaborador_nome
    into r
    from public.bp_pesquisas p
    join public.bp_empresas e on e.id = p.empresa_id
    left join public.bp_colaboradores c on c.id = p.colaborador_id
   where p.token = p_token;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'titulo', r.titulo,
    'descricao', r.descricao,
    'tipo', r.tipo,
    'anonima', r.anonima,
    'empresa', r.empresa,
    'perguntas', r.perguntas,
    'destinatario', split_part(coalesce(r.colaborador_nome, ''), ' ', 1),
    'aberta', r.status = 'aberta' and (r.encerra_em is null or r.encerra_em >= current_date),
    'respondida', r.tipo = 'offboarding' and exists (select 1 from public.bp_respostas x where x.pesquisa_id = r.id)
  );
end;
$$;

create function public.bp_responder_pesquisa(p_token text, p_respostas jsonb, p_nome text default null, p_email text default null, p_area text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.bp_pesquisas;
  v_colab uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'link_invalido';
  end if;
  select * into p from public.bp_pesquisas where token = p_token;
  if not found then
    raise exception 'link_invalido';
  end if;
  if p.status <> 'aberta' or (p.encerra_em is not null and p.encerra_em < current_date) then
    raise exception 'pesquisa_encerrada';
  end if;
  if jsonb_typeof(p_respostas) <> 'object' or pg_column_size(p_respostas) > 60000 then
    raise exception 'respostas_invalidas';
  end if;
  -- Só aceita respostas das perguntas da própria pesquisa.
  if exists (
    select 1 from jsonb_object_keys(p_respostas) k
     where not exists (select 1 from jsonb_array_elements(p.perguntas) q where q ->> 'id' = k)
  ) then
    raise exception 'respostas_invalidas';
  end if;

  if p.tipo = 'offboarding' then
    if exists (select 1 from public.bp_respostas where pesquisa_id = p.id) then
      raise exception 'ja_respondida';
    end if;
    v_colab := p.colaborador_id;
  elsif not p.anonima and nullif(trim(p_email), '') is not null then
    select id into v_colab from public.bp_colaboradores
     where empresa_id = p.empresa_id and lower(email) = lower(trim(p_email));
  end if;

  insert into public.bp_respostas (pesquisa_id, empresa_id, colaborador_id, nome, email, area, respostas)
  values (
    p.id, p.empresa_id, v_colab,
    case when p.anonima then null else left(nullif(trim(p_nome), ''), 160) end,
    case when p.anonima then null else left(nullif(lower(trim(p_email)), ''), 254) end,
    left(nullif(trim(p_area), ''), 80),
    p_respostas
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.bp_pesquisa_publica(text) from public;
revoke execute on function public.bp_responder_pesquisa(text, jsonb, text, text, text) from public;
grant execute on function public.bp_pesquisa_publica(text) to anon, authenticated;
grant execute on function public.bp_responder_pesquisa(text, jsonb, text, text, text) to anon, authenticated;
revoke execute on function public.bp_garantir_empresa(text) from public, anon;
grant execute on function public.bp_garantir_empresa(text) to authenticated;
revoke execute on function public.bp_minhas_empresas() from public, anon;
grant execute on function public.bp_minhas_empresas() to authenticated;
