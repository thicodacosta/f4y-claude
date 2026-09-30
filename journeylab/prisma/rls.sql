-- JourneyLab — isolamento no banco (Row Level Security). Idempotente.
-- Aplicar após cada migração: `npm run db:rls` (que também define a senha do
-- papel da aplicação a partir de JOURNEYLAB_APP_DB_PASSWORD).
--
-- Modelo:
--   * A aplicação conecta como `journeylab_app` — SEM BYPASSRLS.
--   * Cada operação define, na transação:
--       app.tenant_id  → organização ativa
--       app.usuario_id → usuário autenticado
--       app.escopo     → 'tenant' | 'usuario' | 'plataforma'
--   * Tabelas com tenant_id: só enxergam/alteram linhas da organização ativa.
--   * 'plataforma' (área do superadmin) acessa tabelas de plataforma e de
--     tenant, EXCETO tabelas de respostas confidenciais (sem GRANT de leitura
--     para ninguém da aplicação — resultados só por funções agregadas).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'journeylab_app') then
    create role journeylab_app login nobypassrls;
  end if;
end $$;

grant usage on schema public to journeylab_app;
grant select, insert, update, delete on all tables in schema public to journeylab_app;
revoke all on public._prisma_migrations from journeylab_app;
-- A API REST do Supabase (anon/authenticated) não acessa nada.
revoke all on all tables in schema public from anon, authenticated;

create or replace function public.jl_tenant() returns uuid
language sql stable as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;
create or replace function public.jl_usuario() returns uuid
language sql stable as $$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;
create or replace function public.jl_plataforma() returns boolean
language sql stable as $$ select coalesce(current_setting('app.escopo', true), '') = 'plataforma' $$;

-- Política padrão para toda tabela com tenant_id (exceto as tratadas abaixo).
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_name = c.table_name and tb.table_schema = c.table_schema
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and tb.table_type = 'BASE TABLE'
      and c.table_name not in ('entitlements', 'historico_entitlements', 'associacoes', 'auditoria', 'acessos_suporte', 'anotacoes_reuniao',
                             'participacoes_pulse', 'respostas_pulse', 'modelos_pulse',
                             'participacoes_nr1', 'respostas_nr1',
                             'pdis', 'focos_pdi', 'acoes_pdi', 'comentarios_acao_pdi', 'registros_pdi')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists isolamento_tenant on public.%I', t);
    execute format(
      'create policy isolamento_tenant on public.%I for all to journeylab_app
         using (tenant_id = public.jl_tenant() or public.jl_plataforma())
         with check (tenant_id = public.jl_tenant() or public.jl_plataforma())', t);
  end loop;
end $$;

-- Entitlements e histórico: organização LÊ os seus; só a plataforma altera.
do $$
declare t text;
begin
  foreach t in array array['entitlements', 'historico_entitlements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists leitura on public.%I', t);
    execute format('drop policy if exists escrita_plataforma on public.%I', t);
    execute format('create policy leitura on public.%I for select to journeylab_app
      using (tenant_id = public.jl_tenant() or public.jl_plataforma())', t);
    execute format('create policy escrita_plataforma on public.%I for all to journeylab_app
      using (public.jl_plataforma()) with check (public.jl_plataforma())', t);
  end loop;
end $$;

-- Associações: organização ativa, o próprio usuário (lista de empresas) ou plataforma.
alter table public.associacoes enable row level security;
drop policy if exists acesso on public.associacoes;
create policy acesso on public.associacoes for all to journeylab_app
  using (tenant_id = public.jl_tenant() or usuario_id = public.jl_usuario() or public.jl_plataforma())
  with check (tenant_id = public.jl_tenant() or public.jl_plataforma());

-- Auditoria: organização vê/insere as suas; plataforma vê tudo e insere as de plataforma.
alter table public.auditoria enable row level security;
drop policy if exists leitura on public.auditoria;
drop policy if exists insercao on public.auditoria;
create policy leitura on public.auditoria for select to journeylab_app
  using (tenant_id = public.jl_tenant() or public.jl_plataforma());
create policy insercao on public.auditoria for insert to journeylab_app
  with check (tenant_id = public.jl_tenant() or public.jl_plataforma());

-- Acessos de suporte: a organização vê quem acessou; só a plataforma cria/encerra.
alter table public.acessos_suporte enable row level security;
drop policy if exists leitura on public.acessos_suporte;
drop policy if exists escrita_plataforma on public.acessos_suporte;
create policy leitura on public.acessos_suporte for select to journeylab_app
  using (tenant_id = public.jl_tenant() or public.jl_plataforma() or superadmin_id = public.jl_usuario());
create policy escrita_plataforma on public.acessos_suporte for all to journeylab_app
  using (public.jl_plataforma()) with check (public.jl_plataforma());

-- Usuários: a própria linha, membros da organização ativa, ou plataforma.
alter table public.usuarios enable row level security;
drop policy if exists acesso on public.usuarios;
create policy acesso on public.usuarios for all to journeylab_app
  using (
    id = public.jl_usuario() or public.jl_plataforma()
    or id in (select usuario_id from public.associacoes where tenant_id = public.jl_tenant())
  )
  with check (id = public.jl_usuario() or public.jl_plataforma());

-- Organizações: a ativa, as que o usuário integra, ou plataforma. Só a plataforma altera.
alter table public.organizacoes enable row level security;
drop policy if exists leitura on public.organizacoes;
drop policy if exists escrita_plataforma on public.organizacoes;
create policy leitura on public.organizacoes for select to journeylab_app
  using (
    id = public.jl_tenant() or public.jl_plataforma()
    or id in (select tenant_id from public.associacoes where usuario_id = public.jl_usuario())
  );
create policy escrita_plataforma on public.organizacoes for all to journeylab_app
  using (public.jl_plataforma()) with check (public.jl_plataforma());

-- Consentimentos: do próprio usuário (ou plataforma).
alter table public.consentimentos enable row level security;
drop policy if exists acesso on public.consentimentos;
create policy acesso on public.consentimentos for all to journeylab_app
  using (usuario_id = public.jl_usuario() or public.jl_plataforma())
  with check (usuario_id = public.jl_usuario() or public.jl_plataforma());

-- Tabelas só de plataforma.
do $$
declare t text;
begin
  foreach t in array array['produtos_externos', 'eventos_integracao'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists plataforma on public.%I', t);
    execute format('create policy plataforma on public.%I for all to journeylab_app
      using (public.jl_plataforma()) with check (public.jl_plataforma())', t);
  end loop;
end $$;

-- Auditoria e históricos imutáveis (nem a aplicação altera/exclui).
create or replace function public.jl_bloquear_alteracao() returns trigger
language plpgsql as $$
begin
  raise exception 'Registro de auditoria/histórico não pode ser alterado nem excluído';
end $$;

drop trigger if exists imutavel on public.auditoria;
create trigger imutavel before update or delete on public.auditoria
  for each row execute function public.jl_bloquear_alteracao();
drop trigger if exists imutavel on public.historico_entitlements;
create trigger imutavel before update or delete on public.historico_entitlements
  for each row execute function public.jl_bloquear_alteracao();

-- Convites: garantir o perfil de uma pessoa (id do Supabase Auth, resolvido
-- no servidor com a service role). Função restrita — não expõe dados.
create or replace function public.jl_garantir_usuario(p_id uuid, p_email text, p_nome text)
returns void language sql security definer set search_path = public as $$
  insert into public.usuarios (id, email, nome) values (p_id, lower(p_email), p_nome)
  on conflict (id) do nothing;
$$;
revoke all on function public.jl_garantir_usuario(uuid, text, text) from public;
grant execute on function public.jl_garantir_usuario(uuid, text, text) to journeylab_app;

-- Onboarding: no máximo um em andamento por colaborador.
create unique index if not exists onboarding_um_ativo on public.onboardings (colaborador_id) where status = 'em_andamento';

-- Feedback 1:1 — anotações. Regra de privacidade aplicada NO BANCO:
--   compartilhada → só os dois participantes da reunião (gestor e liderado);
--   privada       → só o autor.
-- Nem administrador, nem RH, nem a plataforma/suporte leem anotações.
create or replace function public.jl_participa_reuniao(p_reuniao uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.reunioes r
    join public.associacoes a
      on a.tenant_id = r.tenant_id and a.colaborador_id in (r.gestor_id, r.colaborador_id)
    where r.id = p_reuniao and r.tenant_id = public.jl_tenant()
      and a.usuario_id = public.jl_usuario() and a.status = 'ativa'
  )
$$;

alter table public.anotacoes_reuniao enable row level security;
drop policy if exists isolamento_tenant on public.anotacoes_reuniao;
drop policy if exists leitura on public.anotacoes_reuniao;
drop policy if exists insercao on public.anotacoes_reuniao;
drop policy if exists alteracao on public.anotacoes_reuniao;
drop policy if exists exclusao on public.anotacoes_reuniao;
create policy leitura on public.anotacoes_reuniao for select to journeylab_app
  using (
    tenant_id = public.jl_tenant() and (
      (visibilidade = 'privada' and autor_usuario_id = public.jl_usuario())
      or (visibilidade = 'compartilhada' and public.jl_participa_reuniao(reuniao_id))
    )
  );
create policy insercao on public.anotacoes_reuniao for insert to journeylab_app
  with check (tenant_id = public.jl_tenant() and autor_usuario_id = public.jl_usuario() and public.jl_participa_reuniao(reuniao_id));
create policy alteracao on public.anotacoes_reuniao for update to journeylab_app
  using (tenant_id = public.jl_tenant() and autor_usuario_id = public.jl_usuario())
  with check (tenant_id = public.jl_tenant() and autor_usuario_id = public.jl_usuario() and public.jl_participa_reuniao(reuniao_id));
create policy exclusao on public.anotacoes_reuniao for delete to journeylab_app
  using (tenant_id = public.jl_tenant() and autor_usuario_id = public.jl_usuario());


-- ════════════════════════════════════════════════════════════════════════
-- Pulse — anonimato e mínimo de respondentes aplicados NO BANCO.
-- ════════════════════════════════════════════════════════════════════════

-- Respostas: a aplicação não lê, não grava, não altera. RLS ligado sem policy.
revoke all on public.respostas_pulse from journeylab_app;
alter table public.respostas_pulse enable row level security;
drop policy if exists isolamento_tenant on public.respostas_pulse;

-- Participações (quem respondeu): cada pessoa lê só a própria (a plataforma confere
-- "já respondeu" na página pública); gravação só pela função.
revoke insert, update, delete on public.participacoes_pulse from journeylab_app;
alter table public.participacoes_pulse enable row level security;
drop policy if exists isolamento_tenant on public.participacoes_pulse;
drop policy if exists propria on public.participacoes_pulse;
create policy propria on public.participacoes_pulse for select to journeylab_app
  using (
    public.jl_plataforma() or (tenant_id = public.jl_tenant() and colaborador_id = (
      select a.colaborador_id from public.associacoes a
      where a.tenant_id = public.jl_tenant() and a.usuario_id = public.jl_usuario() and a.status = 'ativa'
    ))
  );

create or replace function public.jl_modulo_liberado(p_tenant uuid, p_modulo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entitlements e
    where e.tenant_id = p_tenant and e.modulo::text = p_modulo and e.status::text in ('ativo', 'teste')
      and e.inicio <= now() and (e.fim is null or e.fim >= now())
  )
$$;

-- Funções da versão anterior (assinaturas/colunas mudaram).
drop function if exists public.jl_responder_pulse(uuid, jsonb);
drop function if exists public.jl_resultado_pulse(uuid, uuid);
drop function if exists public.jl_resumo_pulse(uuid, uuid);
drop function if exists public.jl_comentarios_pulse(uuid, uuid);

-- Templates: globais (tenant nulo) legíveis por todas as organizações; os da empresa, só por ela.
alter table public.modelos_pulse enable row level security;
drop policy if exists isolamento_tenant on public.modelos_pulse;
drop policy if exists leitura on public.modelos_pulse;
drop policy if exists escrita on public.modelos_pulse;
create policy leitura on public.modelos_pulse for select to journeylab_app
  using (tenant_id is null or tenant_id = public.jl_tenant() or public.jl_plataforma());
create policy escrita on public.modelos_pulse for all to journeylab_app
  using (tenant_id = public.jl_tenant() or public.jl_plataforma())
  with check (tenant_id = public.jl_tenant() or public.jl_plataforma());

/** Data civil de hoje no fuso da aplicação (mesma regra de lib/datas.ts). */
create or replace function public.jl_hoje() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

/** A pessoa (ativa) está na audiência da pesquisa? */
create or replace function public.jl_na_audiencia_pulse(p_pesquisa uuid, p_colaborador uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pesquisas_pulse p
    join colaboradores c on c.id = p_colaborador and c.tenant_id = p.tenant_id
    left join equipes e on e.id = c.equipe_id
    where p.id = p_pesquisa and c.status = 'ativo' and (
      p.audiencia_tipo = 'todos'
      or (p.audiencia_tipo = 'departamentos' and e.area_id = any (p.area_ids))
      or (p.audiencia_tipo = 'equipes' and c.equipe_id = any (p.equipe_ids))
      or (p.audiencia_tipo = 'colaboradores' and c.id = any (p.colaborador_ids))
    )
  )
$$;

/**
 * Registra um envio de respostas (linhas atômicas já validadas por tipo no
 * servidor). Garante no banco: pesquisa ativa e no prazo, módulo liberado,
 * pessoa ativa na audiência, UMA resposta por pessoa, e — em pesquisa anônima —
 * nenhum identificador nas respostas (só o departamento). Sem pessoa: somente
 * com link aberto habilitado (e sempre anônima).
 * Chamada pelo servidor da aplicação (escopo da organização ou de plataforma para o link público).
 */
create or replace function public.jl_registrar_resposta_pulse(p_pesquisa uuid, p_colaborador uuid, p_linhas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_p record;
  v_area uuid;
  v_lote uuid := gen_random_uuid();
  v_l jsonb;
begin
  select * into v_p from pesquisas_pulse where id = p_pesquisa;
  if not found then
    raise exception 'JL: Pesquisa não encontrada.';
  end if;
  if not (public.jl_plataforma() or v_p.tenant_id = public.jl_tenant()) then
    raise exception 'JL: Acesso negado.';
  end if;
  if not public.jl_modulo_liberado(v_p.tenant_id, 'pulse') then
    raise exception 'JL: Pesquisa indisponível.';
  end if;
  if v_p.status <> 'aberta'
     or (v_p.data_inicio is not null and v_p.data_inicio > public.jl_hoje())
     or (v_p.encerra_em is not null and v_p.encerra_em < public.jl_hoje()) then
    raise exception 'JL: Esta pesquisa não está aberta para respostas.';
  end if;
  if p_colaborador is null then
    if not (v_p.link_aberto and v_p.anonima) then
      raise exception 'JL: Esta pesquisa exige o link pessoal enviado por e-mail.';
    end if;
  else
    if not public.jl_na_audiencia_pulse(p_pesquisa, p_colaborador) then
      raise exception 'JL: Você não faz parte do público desta pesquisa.';
    end if;
    select e.area_id into v_area from colaboradores c left join equipes e on e.id = c.equipe_id where c.id = p_colaborador;
    begin
      insert into participacoes_pulse (id, tenant_id, pesquisa_id, colaborador_id, respondido_em)
      values (gen_random_uuid(), v_p.tenant_id, p_pesquisa, p_colaborador, public.jl_hoje());
    exception when unique_violation then
      raise exception 'JL: Você já respondeu esta pesquisa.';
    end;
  end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'JL: Nenhuma resposta enviada.';
  end if;
  for v_l in select * from jsonb_array_elements(p_linhas) loop
    if not exists (select 1 from perguntas_pulse q where q.id = (v_l ->> 'pergunta_id')::uuid and q.pesquisa_id = p_pesquisa) then
      raise exception 'JL: Resposta inválida.';
    end if;
    insert into respostas_pulse (id, tenant_id, pesquisa_id, pergunta_id, lote, area_id, colaborador_id, linha, valor, opcao, texto)
    values (gen_random_uuid(), v_p.tenant_id, p_pesquisa, (v_l ->> 'pergunta_id')::uuid, v_lote, v_area,
            case when v_p.anonima then null else p_colaborador end,
            (v_l ->> 'linha')::int, (v_l ->> 'valor')::int, left(v_l ->> 'opcao', 100), left(v_l ->> 'texto', 2000));
  end loop;
end $$;

/**
 * Recorte (organização ou departamento) pode ser exibido?
 * Anônima: só encerrada, com respondentes >= mínimo e, por departamento, o
 * complemento (total − recorte) igual a 0 ou também >= mínimo.
 * Identificada: a qualquer momento (as pessoas sabem que são identificadas).
 */
create or replace function public.jl_resumo_pulse(p_pesquisa uuid, p_area uuid default null)
returns table (respondentes int, minimo int, liberado boolean, motivo text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
  v_status text;
  v_anonima boolean;
  v_min int;
  v_total int;
  v_recorte int;
begin
  select p.status::text, p.anonima into v_status, v_anonima from pesquisas_pulse p where p.id = p_pesquisa and p.tenant_id = v_tenant;
  if v_status is null then
    return;
  end if;
  select o.minimo_recorte into v_min from organizacoes o where o.id = v_tenant;
  select count(distinct r.lote) into v_total from respostas_pulse r where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant;
  if p_area is null then
    v_recorte := v_total;
  else
    select count(distinct r.lote) into v_recorte from respostas_pulse r where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant and r.area_id = p_area;
  end if;
  respondentes := v_recorte;
  minimo := v_min;
  if not v_anonima then
    liberado := v_recorte > 0; motivo := case when v_recorte > 0 then null else 'minimo' end;
  elsif v_status <> 'encerrada' then
    liberado := false; motivo := 'aberta';
  elsif v_recorte < v_min then
    liberado := false; motivo := 'minimo';
  elsif p_area is not null and (v_total - v_recorte) > 0 and (v_total - v_recorte) < v_min then
    liberado := false; motivo := 'complemento';
  else
    liberado := true; motivo := null;
  end if;
  return next;
end $$;

/** Distribuição agregada (vale para os 16 tipos) — vazia se o recorte não estiver liberado. */
create or replace function public.jl_distribuicao_pulse(p_pesquisa uuid, p_area uuid default null)
returns table (pergunta_id uuid, linha int, opcao text, valor int, n int, respondentes int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
begin
  if not coalesce((select s.liberado from public.jl_resumo_pulse(p_pesquisa, p_area) s), false) then
    return;
  end if;
  return query
    select r.pergunta_id, r.linha, r.opcao, r.valor, count(*)::int,
           (select count(distinct r2.lote)::int from respostas_pulse r2
             where r2.pergunta_id = r.pergunta_id and r2.tenant_id = v_tenant and (p_area is null or r2.area_id = p_area))
      from respostas_pulse r
     where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant and r.texto is null
       and (p_area is null or r.area_id = p_area)
     group by r.pergunta_id, r.linha, r.opcao, r.valor;
end $$;

/** Textos — só em recorte liberado, em ordem aleatória, sem metadados. */
create or replace function public.jl_comentarios_pulse(p_pesquisa uuid, p_area uuid default null)
returns table (pergunta_id uuid, linha int, texto text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
begin
  if not coalesce((select s.liberado from public.jl_resumo_pulse(p_pesquisa, p_area) s), false) then
    return;
  end if;
  return query
    select r.pergunta_id, r.linha, r.texto from respostas_pulse r
     where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant and r.texto is not null
       and (p_area is null or r.area_id = p_area)
     order by random();
end $$;

/** Adesão: público (congelado no envio) × envios recebidos. Só contagens. */
create or replace function public.jl_adesao_pulse(p_pesquisa uuid)
returns table (publico int, respondentes int)
language sql stable security definer set search_path = public as $$
  select
    case when p.publico_total > 0 then p.publico_total else
      (select count(*)::int from colaboradores c where c.tenant_id = p.tenant_id and public.jl_na_audiencia_pulse(p.id, c.id)) end,
    (select count(distinct r.lote)::int from respostas_pulse r where r.pesquisa_id = p.id)
  from pesquisas_pulse p
  where p.id = p_pesquisa and p.tenant_id = public.jl_tenant()
$$;

/** Respostas por dia (pela data de participação — nunca pela resposta anônima). */
create or replace function public.jl_adesao_diaria_pulse(p_pesquisa uuid)
returns table (dia date, n int)
language sql stable security definer set search_path = public as $$
  select pp.respondido_em, count(*)::int from participacoes_pulse pp
   where pp.pesquisa_id = p_pesquisa and pp.tenant_id = public.jl_tenant()
   group by pp.respondido_em order by 1
$$;

/** Quem respondeu — SOMENTE em pesquisa identificada. */
create or replace function public.jl_participantes_pulse(p_pesquisa uuid)
returns table (colaborador_id uuid, respondido_em date)
language sql stable security definer set search_path = public as $$
  select pp.colaborador_id, pp.respondido_em from participacoes_pulse pp
  join pesquisas_pulse p on p.id = pp.pesquisa_id
   where pp.pesquisa_id = p_pesquisa and p.tenant_id = public.jl_tenant() and not p.anonima
$$;

/** O convite já foi respondido? (a participação só é legível pela própria pessoa). */
create or replace function public.jl_convite_respondido(p_convite uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from convites_pulse c join participacoes_pulse pp on pp.pesquisa_id = c.pesquisa_id and pp.colaborador_id = c.colaborador_id
     where c.id = p_convite and (c.tenant_id = public.jl_tenant() or public.jl_plataforma())
  )
$$;
revoke all on function public.jl_convite_respondido(uuid) from public;
grant execute on function public.jl_convite_respondido(uuid) to journeylab_app;

-- Anônima nunca guarda a pessoa (defesa extra além da função de registro).
create or replace function public.jl_resposta_anonima() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.colaborador_id is not null and (select anonima from pesquisas_pulse where id = new.pesquisa_id) then
    raise exception 'JL: Pesquisa anônima não guarda identificação.';
  end if;
  return new;
end $$;
drop trigger if exists anonima on public.respostas_pulse;
create trigger anonima before insert or update on public.respostas_pulse
  for each row execute function public.jl_resposta_anonima();

revoke all on function public.jl_modulo_liberado(uuid, text) from public;
revoke all on function public.jl_na_audiencia_pulse(uuid, uuid) from public;
revoke all on function public.jl_registrar_resposta_pulse(uuid, uuid, jsonb) from public;
revoke all on function public.jl_resumo_pulse(uuid, uuid) from public;
revoke all on function public.jl_distribuicao_pulse(uuid, uuid) from public;
revoke all on function public.jl_comentarios_pulse(uuid, uuid) from public;
revoke all on function public.jl_adesao_pulse(uuid) from public;
revoke all on function public.jl_adesao_diaria_pulse(uuid) from public;
revoke all on function public.jl_participantes_pulse(uuid) from public;
grant execute on function public.jl_registrar_resposta_pulse(uuid, uuid, jsonb) to journeylab_app;
grant execute on function public.jl_resumo_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_distribuicao_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_comentarios_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_adesao_pulse(uuid) to journeylab_app;
grant execute on function public.jl_adesao_diaria_pulse(uuid) to journeylab_app;
grant execute on function public.jl_participantes_pulse(uuid) to journeylab_app;
grant execute on function public.jl_na_audiencia_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_hoje() to journeylab_app;

-- ════════════════════════════════════════════════════════════════════════
-- Diagnóstico NR-1 — mesmas garantias do Pulse, sem texto livre.
-- Índice de favorabilidade por resposta: (v−1)/4, ou (5−v)/4 se a pergunta é
-- invertida; 0 = desfavorável, 100 = favorável.
-- ════════════════════════════════════════════════════════════════════════

revoke all on public.respostas_nr1 from journeylab_app;
alter table public.respostas_nr1 enable row level security;
drop policy if exists isolamento_tenant on public.respostas_nr1;

revoke insert, update, delete on public.participacoes_nr1 from journeylab_app;
alter table public.participacoes_nr1 enable row level security;
drop policy if exists isolamento_tenant on public.participacoes_nr1;
drop policy if exists propria on public.participacoes_nr1;
create policy propria on public.participacoes_nr1 for select to journeylab_app
  using (
    public.jl_plataforma() or (tenant_id = public.jl_tenant() and colaborador_id = (
      select a.colaborador_id from public.associacoes a
      where a.tenant_id = public.jl_tenant() and a.usuario_id = public.jl_usuario() and a.status = 'ativa'
    ))
  );

create or replace function public.jl_responder_nr1(p_ciclo uuid, p_respostas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
  v_usuario uuid := public.jl_usuario();
  v_colab uuid;
  v_equipe uuid;
  v_status text;
  v_c record;
  v_q record;
  v_lote uuid := gen_random_uuid();
  v_valor int;
begin
  if v_tenant is null or v_usuario is null or current_setting('app.escopo', true) <> 'tenant' then
    raise exception 'JL: Sessão inválida.';
  end if;
  if not public.jl_modulo_liberado(v_tenant, 'nr1') then
    raise exception 'JL: O Diagnóstico NR-1 não está ativo para esta organização.';
  end if;
  select a.colaborador_id into v_colab from associacoes a
   where a.tenant_id = v_tenant and a.usuario_id = v_usuario and a.status = 'ativa';
  if v_colab is null then
    raise exception 'JL: Sua conta não está vinculada a um cadastro de pessoa nesta organização.';
  end if;
  select c.equipe_id, c.status::text into v_equipe, v_status from colaboradores c where c.id = v_colab and c.tenant_id = v_tenant;
  if v_status is distinct from 'ativo' then
    raise exception 'JL: Apenas pessoas ativas participam do diagnóstico.';
  end if;
  select * into v_c from ciclos_nr1 where id = p_ciclo and tenant_id = v_tenant;
  if not found or v_c.status <> 'aberto' or (v_c.encerra_em is not null and v_c.encerra_em < current_date) then
    raise exception 'JL: Este ciclo não está aberto.';
  end if;
  if not v_c.publico_todos and (v_equipe is null or not (v_equipe = any (v_c.equipe_ids))) then
    raise exception 'JL: Você não faz parte do público deste ciclo.';
  end if;
  begin
    insert into participacoes_nr1 (id, tenant_id, ciclo_id, colaborador_id, respondido_em)
    values (gen_random_uuid(), v_tenant, p_ciclo, v_colab, current_date);
  exception when unique_violation then
    raise exception 'JL: Você já participou deste ciclo.';
  end;
  for v_q in select * from perguntas_nr1 where ciclo_id = p_ciclo and tenant_id = v_tenant loop
    begin
      v_valor := (p_respostas ->> v_q.id::text)::int;
    exception when others then
      raise exception 'JL: Resposta inválida.';
    end;
    if v_valor is null or v_valor not between 1 and 5 then
      raise exception 'JL: Responda todas as perguntas.';
    end if;
    insert into respostas_nr1 (id, tenant_id, ciclo_id, pergunta_id, lote, equipe_id, valor)
    values (gen_random_uuid(), v_tenant, p_ciclo, v_q.id, v_lote, v_equipe, v_valor);
  end loop;
end $$;

create or replace function public.jl_resumo_nr1(p_ciclo uuid, p_equipe uuid default null)
returns table (respondentes int, minimo int, liberado boolean, motivo text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
  v_status text;
  v_min int;
  v_total int;
  v_recorte int;
begin
  select c.status::text into v_status from ciclos_nr1 c where c.id = p_ciclo and c.tenant_id = v_tenant;
  if v_status is null then
    return;
  end if;
  select o.minimo_recorte into v_min from organizacoes o where o.id = v_tenant;
  select count(distinct r.lote) into v_total from respostas_nr1 r where r.ciclo_id = p_ciclo and r.tenant_id = v_tenant;
  if p_equipe is null then
    v_recorte := v_total;
  else
    select count(distinct r.lote) into v_recorte from respostas_nr1 r
     where r.ciclo_id = p_ciclo and r.tenant_id = v_tenant and r.equipe_id = p_equipe;
  end if;
  respondentes := v_recorte;
  minimo := v_min;
  if v_status <> 'encerrado' then
    liberado := false; motivo := 'aberta';
  elsif v_recorte < v_min then
    liberado := false; motivo := 'minimo';
  elsif p_equipe is not null and (v_total - v_recorte) > 0 and (v_total - v_recorte) < v_min then
    liberado := false; motivo := 'complemento';
  else
    liberado := true; motivo := null;
  end if;
  return next;
end $$;

/** Por pergunta: índice de favorabilidade (0–100), média de frequência e nº de respostas. */
create or replace function public.jl_resultado_nr1(p_ciclo uuid, p_equipe uuid default null)
returns table (dimensao_id uuid, pergunta_id uuid, indice numeric, media numeric, respostas int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
begin
  if not coalesce((select s.liberado from public.jl_resumo_nr1(p_ciclo, p_equipe) s), false) then
    return;
  end if;
  return query
    select q.dimensao_id, q.id,
           round(avg(case when q.invertida then (5 - r.valor) else (r.valor - 1) end) / 4.0 * 100, 1),
           round(avg(r.valor)::numeric, 2),
           count(r.valor)::int
      from perguntas_nr1 q
      join respostas_nr1 r on r.pergunta_id = q.id and r.tenant_id = v_tenant
           and (p_equipe is null or r.equipe_id = p_equipe)
     where q.ciclo_id = p_ciclo and q.tenant_id = v_tenant
     group by q.dimensao_id, q.id;
end $$;

create or replace function public.jl_adesao_nr1(p_ciclo uuid)
returns table (publico int, respondentes int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from colaboradores c
      where c.tenant_id = x.tenant_id and c.status = 'ativo'
        and (x.publico_todos or c.equipe_id = any (x.equipe_ids))),
    (select count(*)::int from participacoes_nr1 pp where pp.ciclo_id = x.id)
  from ciclos_nr1 x
  where x.id = p_ciclo and x.tenant_id = public.jl_tenant()
$$;

revoke all on function public.jl_responder_nr1(uuid, jsonb) from public;
revoke all on function public.jl_resumo_nr1(uuid, uuid) from public;
revoke all on function public.jl_resultado_nr1(uuid, uuid) from public;
revoke all on function public.jl_adesao_nr1(uuid) from public;
grant execute on function public.jl_responder_nr1(uuid, jsonb) to journeylab_app;
grant execute on function public.jl_resumo_nr1(uuid, uuid) to journeylab_app;
grant execute on function public.jl_resultado_nr1(uuid, uuid) to journeylab_app;
grant execute on function public.jl_adesao_nr1(uuid) to journeylab_app;

-- ════════════════════════════════════════════════════════════════════════
-- Retenção: categorias que a aplicação não enxerga (anotações de 1:1,
-- respostas anônimas). Os prazos vêm SEMPRE de politicas_retencao — a função
-- não aceita prazo por parâmetro. Só a própria organização (tenant ativo) ou a
-- plataforma (rotina diária) executam; mínimo de 1 mês por categoria.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.jl_retencao(p_tenant uuid, p_simular boolean)
returns table (categoria text, quantidade int)
language plpgsql security definer set search_path = public as $$
declare
  v_pol record;
  v_n int;
begin
  if not (public.jl_plataforma() or p_tenant = public.jl_tenant()) then
    raise exception 'JL: Execução de retenção não autorizada.';
  end if;
  select * into v_pol from politicas_retencao where tenant_id = p_tenant;
  if not found then
    return;
  end if;

  if coalesce(v_pol.feedback_notas_meses, 0) >= 1 then
    select count(*) into v_n from anotacoes_reuniao a join reunioes r on r.id = a.reuniao_id
     where a.tenant_id = p_tenant and r.data_hora < now() - make_interval(months => v_pol.feedback_notas_meses);
    if not p_simular and v_n > 0 then
      delete from anotacoes_reuniao a using reunioes r
       where r.id = a.reuniao_id and a.tenant_id = p_tenant and r.data_hora < now() - make_interval(months => v_pol.feedback_notas_meses);
    end if;
    categoria := 'feedback_notas'; quantidade := v_n; return next;
  end if;

  if coalesce(v_pol.pulse_meses, 0) >= 1 then
    select count(*) into v_n from pesquisas_pulse p
     where p.tenant_id = p_tenant and p.status = 'encerrada' and p.encerrada_em < now() - make_interval(months => v_pol.pulse_meses);
    if not p_simular and v_n > 0 then
      delete from pesquisas_pulse p
       where p.tenant_id = p_tenant and p.status = 'encerrada' and p.encerrada_em < now() - make_interval(months => v_pol.pulse_meses);
    end if;
    categoria := 'pulse'; quantidade := v_n; return next;
  end if;

  if coalesce(v_pol.nr1_respostas_meses, 0) >= 1 then
    select count(*) into v_n from respostas_nr1 r join ciclos_nr1 c on c.id = r.ciclo_id
     where r.tenant_id = p_tenant and c.status = 'encerrado' and c.encerrado_em < now() - make_interval(months => v_pol.nr1_respostas_meses);
    if not p_simular and v_n > 0 then
      delete from respostas_nr1 r using ciclos_nr1 c
       where c.id = r.ciclo_id and r.tenant_id = p_tenant and c.status = 'encerrado' and c.encerrado_em < now() - make_interval(months => v_pol.nr1_respostas_meses);
    end if;
    categoria := 'nr1_respostas'; quantidade := v_n; return next;
  end if;
end $$;
revoke all on function public.jl_retencao(uuid, boolean) from public;
grant execute on function public.jl_retencao(uuid, boolean) to journeylab_app;

-- Onboarding v2: no máximo um template padrão por organização e um template ativo por área.
create unique index if not exists modelo_onboarding_um_padrao on public.modelos_onboarding (tenant_id) where padrao;
create unique index if not exists modelo_onboarding_um_por_area on public.modelos_onboarding (tenant_id, area_id) where ativo and area_id is not null;

-- ════════════════════════════════════════════════════════════════════════
-- Feedback 1:1 avaliado — regra ÚNICA de médias e semáforo no banco.
-- Média de Performance = média dos 8 critérios; Cultura = média dos 8;
-- Geral = média das duas dimensões. Semáforo pela média geral:
-- verde ≥ 4,0 · amarelo ≥ 3,0 e < 4,0 · vermelho < 3,0.
-- Também garante que colaborador e gestor pertencem à mesma organização
-- do registro (FK sozinha não impede apontar para outra empresa).
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.jl_calcular_avaliacao() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.colaboradores c where c.id = new.colaborador_id and c.tenant_id = new.tenant_id) then
    raise exception 'JL: Colaborador não pertence a esta organização.';
  end if;
  if new.gestor_id is not null and not exists (select 1 from public.colaboradores c where c.id = new.gestor_id and c.tenant_id = new.tenant_id) then
    raise exception 'JL: Gestor não pertence a esta organização.';
  end if;
  new.media_performance := (new.p_produtividade + new.p_qualidade + new.p_ferramentas + new.p_priorizacao
                          + new.p_tempo + new.p_aprendizado + new.p_relacionamento + new.p_comunicacao)::numeric / 8;
  new.media_cultura := (new.c_criatividade + new.c_confianca + new.c_resultado + new.c_senso_dono
                      + new.c_adaptabilidade + new.c_resiliencia + new.c_longo_prazo + new.c_colaboracao)::numeric / 8;
  new.media_geral := (new.media_performance + new.media_cultura) / 2;
  new.semaforo := case when new.media_geral >= 4 then 'verde'::"Semaforo"
                       when new.media_geral >= 3 then 'amarelo'::"Semaforo"
                       else 'vermelho'::"Semaforo" end;
  return new;
end $$;
drop trigger if exists calcular on public.avaliacoes_feedback;
create trigger calcular before insert or update on public.avaliacoes_feedback
  for each row execute function public.jl_calcular_avaliacao();

-- Reuniões de 1:1: participantes da mesma organização; sem duplicar horário ativo da mesma pessoa.
create or replace function public.jl_reuniao_mesmo_tenant() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.colaboradores c where c.id = new.colaborador_id and c.tenant_id = new.tenant_id)
     or not exists (select 1 from public.colaboradores c where c.id = new.gestor_id and c.tenant_id = new.tenant_id) then
    raise exception 'JL: Participantes da reunião não pertencem a esta organização.';
  end if;
  return new;
end $$;
drop trigger if exists mesmo_tenant on public.reunioes;
create trigger mesmo_tenant before insert or update of colaborador_id, gestor_id, tenant_id on public.reunioes
  for each row execute function public.jl_reuniao_mesmo_tenant();
create unique index if not exists reuniao_sem_duplicidade on public.reunioes (colaborador_id, data_hora) where status <> 'cancelada';

-- ════════════════════════════════════════════════════════════════════════
-- PDI — acesso por papel e vínculo gestor→liderado aplicado NO BANCO.
--   escopo "todos" (RH/Admin) → qualquer pessoa da organização;
--   escopo "equipe" (gestor)  → só liderados diretos (colaboradores.gestor_id);
--   escopo "próprio" não dá acesso (colaborador não acessa o módulo nesta versão);
--   acesso de suporte vigente → só leitura; módulo precisa estar liberado.
-- Excluir exige "editar" com escopo "todos".
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.jl_acesso_pdi(p_colaborador uuid, p_acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.jl_tenant() is not null
     and public.jl_modulo_liberado(public.jl_tenant(), 'pdi')
     and exists (select 1 from colaboradores c where c.id = p_colaborador and c.tenant_id = public.jl_tenant())
     and (
       exists (
         select 1
           from associacoes a
           join papel_permissoes pp on pp.papel_id = a.papel_id and pp.area::text = 'pdi'
                and pp.acao::text = case when p_acao = 'excluir' then 'editar' else p_acao end
           join colaboradores c on c.id = p_colaborador
          where a.tenant_id = public.jl_tenant() and a.usuario_id = public.jl_usuario() and a.status = 'ativa'
            and (pp.escopo = 'todos'
                 or (p_acao <> 'excluir' and pp.escopo = 'equipe' and a.colaborador_id is not null
                     and c.gestor_id = a.colaborador_id and c.id <> a.colaborador_id))
       )
       or (p_acao = 'visualizar' and exists (
         select 1 from acessos_suporte s
          where s.tenant_id = public.jl_tenant() and s.superadmin_id = public.jl_usuario()
            and s.encerrado_em is null and s.expira_em > now()
       ))
     )
$$;
revoke all on function public.jl_acesso_pdi(uuid, text) from public;
grant execute on function public.jl_acesso_pdi(uuid, text) to journeylab_app;

create or replace function public.jl_acesso_pdi_do_plano(p_pdi uuid, p_acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pdis p where p.id = p_pdi and p.tenant_id = public.jl_tenant() and public.jl_acesso_pdi(p.colaborador_id, p_acao))
$$;
revoke all on function public.jl_acesso_pdi_do_plano(uuid, text) from public;
grant execute on function public.jl_acesso_pdi_do_plano(uuid, text) to journeylab_app;

do $$
declare t text;
begin
  foreach t in array array['pdis', 'focos_pdi', 'acoes_pdi', 'comentarios_acao_pdi', 'registros_pdi'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists isolamento_tenant on public.%I', t);
    execute format('drop policy if exists leitura on public.%I', t);
    execute format('drop policy if exists insercao on public.%I', t);
    execute format('drop policy if exists alteracao on public.%I', t);
    execute format('drop policy if exists exclusao on public.%I', t);
    execute format('drop policy if exists plataforma on public.%I', t);
    execute format('create policy plataforma on public.%I for all to journeylab_app using (public.jl_plataforma()) with check (public.jl_plataforma())', t);
  end loop;
end $$;

create policy leitura on public.pdis for select to journeylab_app
  using (tenant_id = public.jl_tenant() and public.jl_acesso_pdi(colaborador_id, 'visualizar'));
create policy insercao on public.pdis for insert to journeylab_app
  with check (tenant_id = public.jl_tenant() and public.jl_acesso_pdi(colaborador_id, 'criar'));
create policy alteracao on public.pdis for update to journeylab_app
  using (tenant_id = public.jl_tenant() and public.jl_acesso_pdi(colaborador_id, 'editar'))
  with check (tenant_id = public.jl_tenant() and public.jl_acesso_pdi(colaborador_id, 'editar'));
create policy exclusao on public.pdis for delete to journeylab_app
  using (tenant_id = public.jl_tenant() and public.jl_acesso_pdi(colaborador_id, 'excluir'));

-- Focos, ações, comentários e registros seguem o plano: ler = visualizar; gravar = editar ou criar.
do $$
declare t text;
begin
  foreach t in array array['focos_pdi', 'acoes_pdi', 'comentarios_acao_pdi', 'registros_pdi'] loop
    execute format('create policy leitura on public.%I for select to journeylab_app
      using (tenant_id = public.jl_tenant() and public.jl_acesso_pdi_do_plano(pdi_id, ''visualizar''))', t);
    execute format('create policy insercao on public.%I for insert to journeylab_app
      with check (tenant_id = public.jl_tenant() and (public.jl_acesso_pdi_do_plano(pdi_id, ''editar'') or public.jl_acesso_pdi_do_plano(pdi_id, ''criar'')))', t);
    execute format('create policy alteracao on public.%I for update to journeylab_app
      using (tenant_id = public.jl_tenant() and public.jl_acesso_pdi_do_plano(pdi_id, ''editar''))
      with check (tenant_id = public.jl_tenant() and public.jl_acesso_pdi_do_plano(pdi_id, ''editar''))', t);
    execute format('create policy exclusao on public.%I for delete to journeylab_app
      using (tenant_id = public.jl_tenant() and public.jl_acesso_pdi_do_plano(pdi_id, ''editar''))', t);
  end loop;
end $$;

-- Ação: foco do mesmo plano; progresso coerente com o status (concluída = 100;
-- não iniciada = sem progresso; em andamento = 1–99 ou vazio, que vale 50%).
create or replace function public.jl_normalizar_acao_pdi() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.focos_pdi f where f.id = new.foco_id and f.pdi_id = new.pdi_id and f.tenant_id = new.tenant_id) then
    raise exception 'JL: O foco não pertence a este PDI.';
  end if;
  if new.status = 'concluida' then
    new.progresso := 100;
    new.concluida_em := coalesce(new.concluida_em, now());
  elsif new.status = 'nao_iniciada' then
    new.progresso := null;
    new.concluida_em := null;
  else
    if new.progresso is not null and (new.progresso < 1 or new.progresso > 99) then new.progresso := null; end if;
    new.concluida_em := null;
  end if;
  return new;
end $$;
drop trigger if exists normalizar on public.acoes_pdi;
create trigger normalizar before insert or update on public.acoes_pdi
  for each row execute function public.jl_normalizar_acao_pdi();

-- Comentário: ação do mesmo plano e autor = usuário da sessão.
create or replace function public.jl_comentario_acao_pdi() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.acoes_pdi a where a.id = new.acao_id and a.pdi_id = new.pdi_id and a.tenant_id = new.tenant_id) then
    raise exception 'JL: A ação não pertence a este PDI.';
  end if;
  if not public.jl_plataforma() and new.autor_usuario_id is distinct from public.jl_usuario() then
    raise exception 'JL: Autor do comentário inválido.';
  end if;
  return new;
end $$;
drop trigger if exists consistente on public.comentarios_acao_pdi;
create trigger consistente before insert or update on public.comentarios_acao_pdi
  for each row execute function public.jl_comentario_acao_pdi();
