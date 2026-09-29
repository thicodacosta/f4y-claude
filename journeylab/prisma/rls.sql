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
                             'participacoes_pulse', 'respostas_pulse',
                             'participacoes_nr1', 'respostas_nr1')
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

-- PDI: no máximo um plano aberto (rascunho ou ativo) por pessoa.
create unique index if not exists pdi_um_aberto on public.pdis (colaborador_id) where status in ('rascunho', 'ativo');

-- ════════════════════════════════════════════════════════════════════════
-- Pulse — anonimato e mínimo de respondentes aplicados NO BANCO.
-- ════════════════════════════════════════════════════════════════════════

-- Respostas: a aplicação não lê, não grava, não altera. RLS ligado sem policy.
revoke all on public.respostas_pulse from journeylab_app;
alter table public.respostas_pulse enable row level security;
drop policy if exists isolamento_tenant on public.respostas_pulse;

-- Participações (quem respondeu): cada pessoa lê só a própria; gravação só pela função.
revoke insert, update, delete on public.participacoes_pulse from journeylab_app;
alter table public.participacoes_pulse enable row level security;
drop policy if exists isolamento_tenant on public.participacoes_pulse;
drop policy if exists propria on public.participacoes_pulse;
create policy propria on public.participacoes_pulse for select to journeylab_app
  using (
    tenant_id = public.jl_tenant() and colaborador_id = (
      select a.colaborador_id from public.associacoes a
      where a.tenant_id = public.jl_tenant() and a.usuario_id = public.jl_usuario() and a.status = 'ativa'
    )
  );

create or replace function public.jl_modulo_liberado(p_tenant uuid, p_modulo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entitlements e
    where e.tenant_id = p_tenant and e.modulo::text = p_modulo and e.status::text in ('ativo', 'teste')
      and e.inicio <= now() and (e.fim is null or e.fim >= now())
  )
$$;

/**
 * Registra uma resposta anônima. Valida tudo no banco: organização ativa,
 * módulo liberado, pessoa ativa vinculada à conta, pesquisa aberta, público,
 * resposta única, tipos e obrigatoriedade. A participação guarda só a DATA;
 * as respostas não guardam pessoa nem horário.
 */
create or replace function public.jl_responder_pulse(p_pesquisa uuid, p_respostas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
  v_usuario uuid := public.jl_usuario();
  v_colab uuid;
  v_equipe uuid;
  v_status text;
  v_p record;
  v_q record;
  v_lote uuid := gen_random_uuid();
  v_bruto jsonb;
  v_valor int;
  v_texto text;
begin
  if v_tenant is null or v_usuario is null or current_setting('app.escopo', true) <> 'tenant' then
    raise exception 'JL: Sessão inválida.';
  end if;
  if not public.jl_modulo_liberado(v_tenant, 'pulse') then
    raise exception 'JL: O Pulse não está ativo para esta organização.';
  end if;
  select a.colaborador_id into v_colab from associacoes a
   where a.tenant_id = v_tenant and a.usuario_id = v_usuario and a.status = 'ativa';
  if v_colab is null then
    raise exception 'JL: Sua conta não está vinculada a um cadastro de pessoa nesta organização.';
  end if;
  select c.equipe_id, c.status::text into v_equipe, v_status from colaboradores c where c.id = v_colab and c.tenant_id = v_tenant;
  if v_status is distinct from 'ativo' then
    raise exception 'JL: Apenas pessoas ativas respondem pesquisas.';
  end if;
  select * into v_p from pesquisas_pulse where id = p_pesquisa and tenant_id = v_tenant;
  if not found or v_p.status <> 'aberta' or (v_p.encerra_em is not null and v_p.encerra_em < current_date) then
    raise exception 'JL: Esta pesquisa não está aberta.';
  end if;
  if not v_p.publico_todos and (v_equipe is null or not (v_equipe = any (v_p.equipe_ids))) then
    raise exception 'JL: Você não faz parte do público desta pesquisa.';
  end if;
  begin
    insert into participacoes_pulse (id, tenant_id, pesquisa_id, colaborador_id, respondido_em)
    values (gen_random_uuid(), v_tenant, p_pesquisa, v_colab, current_date);
  exception when unique_violation then
    raise exception 'JL: Você já respondeu esta pesquisa.';
  end;
  for v_q in select * from perguntas_pulse where pesquisa_id = p_pesquisa and tenant_id = v_tenant order by ordem loop
    v_bruto := p_respostas -> v_q.id::text;
    v_valor := null;
    v_texto := null;
    if v_bruto is null or v_bruto = 'null'::jsonb or btrim(v_bruto #>> '{}') = '' then
      if v_q.obrigatoria then
        raise exception 'JL: Responda todas as perguntas obrigatórias.';
      end if;
      continue;
    end if;
    if v_q.tipo = 'texto' then
      v_texto := left(btrim(v_bruto #>> '{}'), 1000);
    else
      begin
        v_valor := (v_bruto #>> '{}')::int;
      exception when others then
        raise exception 'JL: Resposta inválida.';
      end;
      if (v_q.tipo = 'escala' and v_valor not between 1 and 5)
         or (v_q.tipo = 'enps' and v_valor not between 0 and 10)
         or (v_q.tipo = 'sim_nao' and v_valor not in (0, 1)) then
        raise exception 'JL: Resposta fora da escala.';
      end if;
    end if;
    insert into respostas_pulse (id, tenant_id, pesquisa_id, pergunta_id, lote, equipe_id, valor, texto)
    values (gen_random_uuid(), v_tenant, p_pesquisa, v_q.id, v_lote, v_equipe, v_valor, v_texto);
  end loop;
end $$;

/**
 * Resumo de um recorte (organização inteira ou uma equipe) e se ele pode ser
 * exibido: pesquisa encerrada, respondentes >= mínimo da organização e, em
 * recorte por equipe, o complemento (total − equipe) é 0 ou também >= mínimo.
 */
create or replace function public.jl_resumo_pulse(p_pesquisa uuid, p_equipe uuid default null)
returns table (respondentes int, minimo int, liberado boolean, motivo text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
  v_status text;
  v_min int;
  v_total int;
  v_recorte int;
begin
  select p.status::text into v_status from pesquisas_pulse p where p.id = p_pesquisa and p.tenant_id = v_tenant;
  if v_status is null then
    return;
  end if;
  select o.minimo_recorte into v_min from organizacoes o where o.id = v_tenant;
  select count(distinct r.lote) into v_total from respostas_pulse r where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant;
  if p_equipe is null then
    v_recorte := v_total;
  else
    select count(distinct r.lote) into v_recorte from respostas_pulse r
     where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant and r.equipe_id = p_equipe;
  end if;
  respondentes := v_recorte;
  minimo := v_min;
  if v_status <> 'encerrada' then
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

/** Agregados por pergunta — vazio se o recorte não estiver liberado. */
create or replace function public.jl_resultado_pulse(p_pesquisa uuid, p_equipe uuid default null)
returns table (pergunta_id uuid, respostas int, media numeric, distribuicao jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
begin
  if not coalesce((select s.liberado from public.jl_resumo_pulse(p_pesquisa, p_equipe) s), false) then
    return;
  end if;
  return query
    select q.id,
           count(r.valor)::int,
           round(avg(r.valor)::numeric, 2),
           coalesce((select jsonb_object_agg(d.valor, d.n) from (
              select r2.valor, count(*)::int n from respostas_pulse r2
               where r2.pergunta_id = q.id and r2.tenant_id = v_tenant and r2.valor is not null
                 and (p_equipe is null or r2.equipe_id = p_equipe)
               group by r2.valor) d), '{}'::jsonb)
      from perguntas_pulse q
      left join respostas_pulse r on r.pergunta_id = q.id and r.tenant_id = v_tenant
           and (p_equipe is null or r.equipe_id = p_equipe)
     where q.pesquisa_id = p_pesquisa and q.tenant_id = v_tenant and q.tipo <> 'texto'
     group by q.id;
end $$;

/** Comentários livres — só em recorte liberado, em ordem aleatória, sem qualquer metadado. */
create or replace function public.jl_comentarios_pulse(p_pesquisa uuid, p_equipe uuid default null)
returns table (pergunta_id uuid, texto text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := public.jl_tenant();
begin
  if not coalesce((select s.liberado from public.jl_resumo_pulse(p_pesquisa, p_equipe) s), false) then
    return;
  end if;
  return query
    select r.pergunta_id, r.texto from respostas_pulse r
     where r.pesquisa_id = p_pesquisa and r.tenant_id = v_tenant and r.texto is not null
       and (p_equipe is null or r.equipe_id = p_equipe)
     order by random();
end $$;

/** Adesão (público elegível × respondentes): só contagens, nunca nomes. */
create or replace function public.jl_adesao_pulse(p_pesquisa uuid)
returns table (publico int, respondentes int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from colaboradores c
      where c.tenant_id = p.tenant_id and c.status = 'ativo'
        and (p.publico_todos or c.equipe_id = any (p.equipe_ids))),
    (select count(*)::int from participacoes_pulse pp where pp.pesquisa_id = p.id)
  from pesquisas_pulse p
  where p.id = p_pesquisa and p.tenant_id = public.jl_tenant()
$$;

revoke all on function public.jl_modulo_liberado(uuid, text) from public;
revoke all on function public.jl_responder_pulse(uuid, jsonb) from public;
revoke all on function public.jl_resumo_pulse(uuid, uuid) from public;
revoke all on function public.jl_resultado_pulse(uuid, uuid) from public;
revoke all on function public.jl_comentarios_pulse(uuid, uuid) from public;
revoke all on function public.jl_adesao_pulse(uuid) from public;
grant execute on function public.jl_responder_pulse(uuid, jsonb) to journeylab_app;
grant execute on function public.jl_resumo_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_resultado_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_comentarios_pulse(uuid, uuid) to journeylab_app;
grant execute on function public.jl_adesao_pulse(uuid) to journeylab_app;

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
    tenant_id = public.jl_tenant() and colaborador_id = (
      select a.colaborador_id from public.associacoes a
      where a.tenant_id = public.jl_tenant() and a.usuario_id = public.jl_usuario() and a.status = 'ativa'
    )
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
