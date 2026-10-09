-- Liberação automática pelo Asaas (Edge Function asaas-webhook).
--
-- O Asaas avisa a função a cada evento de pagamento/assinatura. A função
-- registra o aviso em asaas_eventos (uma vez só por id: o Asaas reenvia),
-- mantém a situação de cada assinatura em assinaturas e libera ou retira o
-- produto da conta (conceder_produto / revogar_produto, da migração de
-- acesso por produto). Uma rotina diária retira o acesso de quem passou da
-- tolerância de atraso.
--
-- Tabelas sem políticas RLS: só a função (chave secreta) e o SQL Editor leem.

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  user_id uuid references auth.users (id) on delete set null,
  produto text not null check (produto in ('recruiter', 'bp')),
  status text not null check (status in ('ativa', 'atrasada', 'suspensa', 'cancelada', 'estornada')),
  asaas_assinatura text,
  asaas_cliente text,
  ultimo_pagamento date,
  atrasada_desde date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (email, produto)
);
create index assinaturas_atraso_idx on public.assinaturas (atrasada_desde) where status = 'atrasada';

create table public.asaas_eventos (
  id text primary key, -- id do evento no Asaas (idempotência)
  evento text not null,
  pagamento text,
  assinatura text,
  email text,
  produto text,
  resultado text,
  payload jsonb not null,
  recebido_em timestamptz not null default now()
);

alter table public.assinaturas enable row level security;
alter table public.asaas_eventos enable row level security;
revoke all on public.assinaturas, public.asaas_eventos from anon, authenticated;
grant all on public.assinaturas, public.asaas_eventos to service_role;

create trigger assinaturas_atualizado before update on public.assinaturas
  for each row execute function public.bp_tocar_atualizado();

-- A função do Asaas usa as mesmas funções de administração do SQL Editor.
grant execute on function public.conceder_produto(text, text) to service_role;
grant execute on function public.revogar_produto(text, text) to service_role;

-- Id da conta por e-mail (para a função decidir entre criar e liberar).
create function public.conta_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke execute on function public.conta_por_email(text) from public, anon, authenticated;
grant execute on function public.conta_por_email(text) to service_role;

-- Retira o acesso de quem está em atraso há mais que a tolerância.
create function public.expirar_assinaturas(p_tolerancia_dias int default 5)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, email, produto from public.assinaturas
     where status = 'atrasada' and atrasada_desde < current_date - p_tolerancia_dias
  loop
    begin
      perform public.revogar_produto(r.email, r.produto);
    exception when others then
      null; -- conta apagada: só atualiza a situação
    end;
    update public.assinaturas set status = 'suspensa' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.expirar_assinaturas(int) from public, anon, authenticated;
grant execute on function public.expirar_assinaturas(int) to service_role;

-- Rotina diária (06:15 UTC) com o pg_cron do Supabase.
create extension if not exists pg_cron;
select cron.schedule('candydate-expirar-assinaturas', '15 6 * * *', 'select public.expirar_assinaturas(5)');
