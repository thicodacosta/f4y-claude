-- Acesso por produto: as contas são as mesmas (Supabase Auth), mas cada
-- extensão só abre para quem tem o produto liberado.
--
--   app_metadata.produtos = ["recruiter"] | ["bp"] | ["recruiter", "bp"]
--
-- app_metadata só pode ser alterado pelo administrador (SQL Editor ou chave
-- secreta); o usuário não consegue se dar acesso. As extensões conferem no
-- login, e o banco bloqueia os dados do BP para quem não tem "bp".
--
-- Administração (SQL Editor do Supabase):
--   select public.conceder_produto('pessoa@empresa.com', 'bp');
--   select public.revogar_produto('pessoa@empresa.com', 'recruiter');
--   select * from public.produtos_por_conta();

-- Contas existentes continuam como estão: todas usavam o Recruiter (ToolsKit);
-- quem já entrou no BP também fica com o BP.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
         'produtos',
         case when exists (select 1 from public.bp_membros m where m.user_id = u.id)
              then '["recruiter", "bp"]'::jsonb
              else '["recruiter"]'::jsonb end)
 where u.raw_app_meta_data -> 'produtos' is null;

create function public.conceder_produto(p_email text, p_produto text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produtos jsonb;
begin
  if p_produto not in ('recruiter', 'bp') then
    raise exception 'Produto inválido: use ''recruiter'' ou ''bp''.';
  end if;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('produtos', (
           select coalesce(jsonb_agg(distinct v order by v), '[]'::jsonb)
             from (select jsonb_array_elements_text(coalesce(raw_app_meta_data -> 'produtos', '[]'::jsonb)) as v
                   union select p_produto) t))
   where lower(email) = lower(trim(p_email))
  returning raw_app_meta_data -> 'produtos' into v_produtos;
  if v_produtos is null then
    raise exception 'Conta % não encontrada. Crie em Authentication › Users antes.', p_email;
  end if;
  return v_produtos;
end;
$$;

create function public.revogar_produto(p_email text, p_produto text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produtos jsonb;
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('produtos', (
           select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
             from jsonb_array_elements_text(coalesce(raw_app_meta_data -> 'produtos', '[]'::jsonb)) as v
            where v <> p_produto))
   where lower(email) = lower(trim(p_email))
  returning raw_app_meta_data -> 'produtos' into v_produtos;
  if v_produtos is null then
    raise exception 'Conta % não encontrada.', p_email;
  end if;
  return v_produtos;
end;
$$;

create function public.produtos_por_conta()
returns table (email text, produtos jsonb, ultimo_acesso timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, coalesce(u.raw_app_meta_data -> 'produtos', '[]'::jsonb), u.last_sign_in_at
    from auth.users u
   order by u.email
$$;

-- Só o administrador (SQL Editor / chave secreta) usa estas funções.
revoke execute on function public.conceder_produto(text, text) from public, anon, authenticated;
revoke execute on function public.revogar_produto(text, text) from public, anon, authenticated;
revoke execute on function public.produtos_por_conta() from public, anon, authenticated;

-- A conta logada tem o produto? (lido do JWT da sessão)
create function public.bp_tem_acesso()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'produtos') ? 'bp', false)
$$;

-- Sem o produto BP, nenhuma empresa: todas as políticas do BP bloqueiam.
create or replace function public.bp_minhas_empresas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select empresa_id from public.bp_membros
   where user_id = (select auth.uid()) and public.bp_tem_acesso()
$$;

create or replace function public.bp_garantir_empresa(p_nome text)
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
  if not public.bp_tem_acesso() then
    raise exception 'sem_acesso_bp';
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
