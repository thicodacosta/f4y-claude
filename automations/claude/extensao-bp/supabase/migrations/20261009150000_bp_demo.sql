-- Cenário de demonstração (Configurações › Cenário de demonstração).
--
-- Tudo o que o gerador cria fica marcado com demo = true, inclusive os eventos
-- do histórico (os gatilhos herdam a marca da linha de origem). Os campos que
-- o gerador preenche nos colaboradores reais ficam guardados em demo_original,
-- para a remoção devolver o cadastro exatamente como era.

alter table public.bp_colaboradores add column demo_original jsonb;
alter table public.bp_onboardings add column demo boolean not null default false;
alter table public.bp_avaliacoes add column demo boolean not null default false;
alter table public.bp_pesquisas add column demo boolean not null default false;
alter table public.bp_desligamentos add column demo boolean not null default false;
alter table public.bp_historico add column demo boolean not null default false;

create index bp_historico_demo_idx on public.bp_historico (empresa_id) where demo;

-- Registro no histórico com a marca de demonstração.
drop function public.bp_registrar(uuid, uuid, text, text, text, jsonb);
create function public.bp_registrar(p_empresa uuid, p_colab uuid, p_modulo text, p_evento text, p_resumo text, p_dados jsonb, p_demo boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.bp_historico (empresa_id, colaborador_id, modulo, evento, resumo, dados, demo)
  values (p_empresa, p_colab, p_modulo, p_evento, p_resumo, p_dados, coalesce(p_demo, false))
$$;
revoke execute on function public.bp_registrar(uuid, uuid, text, text, text, jsonb, boolean) from public, anon, authenticated;

create or replace function public.bp_hist_colaborador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mudancas text[] := '{}';
  v_demo boolean;
begin
  if tg_op = 'INSERT' then
    perform public.bp_registrar(new.empresa_id, new.id, 'pessoas', 'cadastro',
      'Cadastro' || coalesce(' como ' || new.cargo, '') || coalesce(' · ' || new.area, ''),
      jsonb_build_object('cargo', new.cargo, 'area', new.area, 'admissao', new.admissao));
    return new;
  end if;
  -- Alterações feitas pelo gerador (ou pela remoção) do cenário de demonstração.
  v_demo := new.demo_original is not null or old.demo_original is not null;
  if new.cargo is distinct from old.cargo then mudancas := mudancas || ('cargo: ' || coalesce(old.cargo, '—') || ' → ' || coalesce(new.cargo, '—')); end if;
  if new.area is distinct from old.area then mudancas := mudancas || ('área: ' || coalesce(old.area, '—') || ' → ' || coalesce(new.area, '—')); end if;
  if new.gestor is distinct from old.gestor then mudancas := mudancas || ('gestor: ' || coalesce(old.gestor, '—') || ' → ' || coalesce(new.gestor, '—')); end if;
  if new.salario is distinct from old.salario then mudancas := mudancas || 'remuneração atualizada'::text; end if;
  if new.status is distinct from old.status then mudancas := mudancas || ('status: ' || old.status || ' → ' || new.status); end if;
  if array_length(mudancas, 1) > 0 then
    perform public.bp_registrar(new.empresa_id, new.id, 'pessoas', 'alteracao',
      'Cadastro alterado (' || array_to_string(mudancas, '; ') || ')', null, v_demo);
  end if;
  return new;
end;
$$;

create or replace function public.bp_hist_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'onboarding', 'inicio',
      'Onboarding 30/60/90 iniciado em ' || to_char(new.inicio, 'DD/MM/YYYY'), null, new.demo);
  elsif new.status is distinct from old.status then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'onboarding', new.status,
      case new.status when 'concluido' then 'Onboarding concluído' when 'cancelado' then 'Onboarding cancelado' else 'Onboarding reaberto' end,
      jsonb_build_object('progresso', new.progresso), new.demo);
  elsif (new.progresso / 25) > (old.progresso / 25) then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'onboarding', 'progresso',
      'Onboarding em ' || new.progresso || '%', jsonb_build_object('progresso', new.progresso), new.demo);
  end if;
  return new;
end;
$$;

create or replace function public.bp_hist_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bp_registrar(new.empresa_id, new.colaborador_id, new.dimensao, 'avaliacao',
    'Avaliação de ' || case new.dimensao when 'produtividade' then 'Produtividade' else 'Cultura' end
      || ': média ' || replace(to_char(new.media, 'FM0.0'), '.', ','),
    jsonb_build_object('avaliacao_id', new.id, 'media', new.media, 'data', new.data), new.demo);
  return new;
end;
$$;

create or replace function public.bp_hist_desligamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.bp_colaboradores set status = 'desligado', desligamento = new.data where id = new.colaborador_id;
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'offboarding', 'desligamento',
      'Desligamento registrado em ' || to_char(new.data, 'DD/MM/YYYY') || case when new.voluntario then ' (voluntário)' else ' (involuntário)' end,
      jsonb_build_object('tipo', new.tipo, 'motivo', new.motivo, 'custo', new.custo), new.demo);
  elsif new.entrevista is not null and old.entrevista is null then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'offboarding', 'entrevista',
      'Entrevista de desligamento respondida', null, new.demo);
  end if;
  return new;
end;
$$;

create or replace function public.bp_desfazer_desligamento()
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
  perform public.bp_registrar(old.empresa_id, old.colaborador_id, 'offboarding', 'desfeito', 'Registro de desligamento excluído', null, old.demo);
  return old;
end;
$$;

create or replace function public.bp_hist_resposta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo text;
  v_tipo text;
  v_demo boolean;
begin
  select titulo, tipo, demo into v_titulo, v_tipo, v_demo from public.bp_pesquisas where id = new.pesquisa_id;
  if v_tipo = 'offboarding' then
    update public.bp_desligamentos
       set entrevista = new.respostas, entrevista_em = now()
     where pesquisa_id = new.pesquisa_id and entrevista is null;
  elsif new.colaborador_id is not null then
    perform public.bp_registrar(new.empresa_id, new.colaborador_id, 'pulso', 'resposta',
      'Respondeu à pesquisa "' || v_titulo || '"', jsonb_build_object('pesquisa_id', new.pesquisa_id), v_demo);
  end if;
  return new;
end;
$$;

-- Respostas fictícias: só em pesquisas de demonstração da própria empresa.
create policy bp_respostas_demo on public.bp_respostas for insert to authenticated
  with check (
    empresa_id in (select public.bp_minhas_empresas())
    and exists (select 1 from public.bp_pesquisas p where p.id = pesquisa_id and p.demo and p.empresa_id = bp_respostas.empresa_id)
  );

-- A remoção do cenário apaga os eventos de demonstração do histórico.
create policy bp_historico_demo_excluir on public.bp_historico for delete to authenticated
  using (demo and empresa_id in (select public.bp_minhas_empresas()));
