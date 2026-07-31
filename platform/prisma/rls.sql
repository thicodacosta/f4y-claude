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

-- 1.1) `atualizado_em` usa `@updatedAt` no Prisma, que só é aplicado pelo
--      Prisma Client em escrita via Prisma — não vira DEFAULT no banco. A
--      trigger do item 4 insere direto via SQL (fora do Prisma), então
--      precisa de um DEFAULT no banco para não violar NOT NULL.
alter table public.usuarios alter column atualizado_em set default now();

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
  insert into public.usuarios (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    null
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
