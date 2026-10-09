-- Cupons de checkout, únicos para todos os canais (página de assinatura,
-- site, extensões): todos usam a Edge Function checkout, que valida aqui.
--
--   tipo 'gratuito'  : libera o produto sem cobrança e sem prazo (ex.: CANDYFREE)
--   uso por pessoa   : um e-mail usa o mesmo cupom uma vez em cada produto
--
-- Administração (SQL Editor):
--   insert into public.cupons (codigo, descricao, produtos) values ('PARCEIRO', 'Parceiros', '{bp}');
--   update public.cupons set ativo = false where codigo = 'CANDYFREE';   -- desativar
--   select * from public.cupom_usos order by criado_em desc;             -- quem usou

create table public.cupons (
  codigo text primary key check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9_-]{3,40}$'),
  descricao text,
  tipo text not null default 'gratuito' check (tipo in ('gratuito')),
  produtos text[] not null default '{bp,recruiter}' check (produtos <@ array['bp', 'recruiter']),
  ativo boolean not null default true,
  valido_ate date,
  limite_total int check (limite_total is null or limite_total > 0),
  criado_em timestamptz not null default now()
);

create table public.cupom_usos (
  id uuid primary key default gen_random_uuid(),
  cupom text not null references public.cupons (codigo) on update cascade,
  email text not null,
  nome text,
  produto text not null check (produto in ('recruiter', 'bp')),
  criado_em timestamptz not null default now(),
  unique (cupom, email, produto) -- uma vez por pessoa em cada produto
);

alter table public.cupons enable row level security;
alter table public.cupom_usos enable row level security;
revoke all on public.cupons, public.cupom_usos from anon, authenticated;
grant all on public.cupons, public.cupom_usos to service_role;

-- Origem da assinatura (pagamento no Asaas ou cupom).
alter table public.assinaturas add column origem text not null default 'asaas' check (origem in ('asaas', 'cupom'));
alter table public.assinaturas add column cupom text;

insert into public.cupons (codigo, descricao, produtos)
values ('CANDYFREE', 'Acesso gratuito e sem prazo ao Business Partner ou ao Recruiter', '{bp,recruiter}');
