-- Teste gratuito (Recruiter e BP): 100 mil tokens ou 3 dias, o que vier
-- primeiro. Uma vez por pessoa em cada produto: o mesmo e-mail OU o mesmo CPF
-- não repete o teste. Ao terminar, o produto é retirado e as extensões mostram
-- a tela de assinatura. Assinar (Asaas) ou usar cupom converte o teste.
--
-- O consumo é informado pelas extensões a cada chamada de IA (Edge Function
-- plano); o prazo e o saldo ficam aqui, no servidor.
--
-- Administração (SQL Editor):
--   select * from public.testes order by inicio desc;
--   select * from public.clientes order by criado_em desc;

create table public.clientes (
  email text primary key check (email = lower(email)),
  nome text not null,
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  telefone text not null,
  asaas_cliente text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index clientes_cpf_idx on public.clientes (cpf);

create table public.testes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  produto text not null check (produto in ('recruiter', 'bp')),
  user_id uuid references auth.users (id) on delete set null,
  inicio timestamptz not null default now(),
  fim timestamptz not null default now() + interval '3 days',
  limite_tokens int not null default 100000,
  tokens_usados int not null default 0,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado', 'convertido')),
  motivo_fim text check (motivo_fim in ('tokens', 'prazo')),
  encerrado_em timestamptz,
  unique (email, produto), -- uma vez por e-mail em cada produto
  unique (cpf, produto)    -- e uma vez por CPF em cada produto
);

-- Consumo de IA por conta, produto e dia (todas as contas, para acompanhamento).
create table public.uso_ia (
  user_id uuid not null references auth.users (id) on delete cascade,
  produto text not null check (produto in ('recruiter', 'bp')),
  dia date not null default current_date,
  tokens bigint not null default 0,
  chamadas int not null default 0,
  primary key (user_id, produto, dia)
);

-- "Esqueci o e-mail" (Edge Function lembrar-email): consultas por conexão,
-- para limitar tentativas (guarda só o resumo do IP).
create table public.lembretes_email (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  criado_em timestamptz not null default now()
);
create index lembretes_email_ip_idx on public.lembretes_email (ip_hash, criado_em);

alter table public.clientes enable row level security;
alter table public.testes enable row level security;
alter table public.uso_ia enable row level security;
alter table public.lembretes_email enable row level security;
revoke all on public.clientes, public.testes, public.uso_ia, public.lembretes_email from anon, authenticated;
grant all on public.clientes, public.testes, public.uso_ia, public.lembretes_email to service_role;

create trigger clientes_atualizado before update on public.clientes for each row execute function public.bp_tocar_atualizado();

-- Registra o consumo e devolve o teste ativo atualizado (se houver).
create function public.registrar_uso(p_user uuid, p_produto text, p_tokens int)
returns public.testes
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.testes;
begin
  insert into public.uso_ia (user_id, produto, dia, tokens, chamadas)
  values (p_user, p_produto, current_date, greatest(p_tokens, 0), 1)
  on conflict (user_id, produto, dia)
  do update set tokens = public.uso_ia.tokens + excluded.tokens, chamadas = public.uso_ia.chamadas + 1;

  update public.testes
     set tokens_usados = tokens_usados + greatest(p_tokens, 0)
   where user_id = p_user and produto = p_produto and status = 'ativo'
  returning * into t;
  return t;
end;
$$;

-- Encerra o teste (prazo ou tokens) e retira o produto da conta.
create function public.encerrar_teste(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.testes;
begin
  update public.testes
     set status = 'encerrado', motivo_fim = p_motivo, encerrado_em = now()
   where id = p_id and status = 'ativo'
  returning * into t;
  if t.id is not null then
    begin
      perform public.revogar_produto(t.email, t.produto);
    exception when others then
      null; -- conta apagada
    end;
  end if;
end;
$$;

-- Rotina de hora em hora: encerra testes vencidos (prazo ou tokens).
create function public.expirar_testes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in select id, case when tokens_usados >= limite_tokens then 'tokens' else 'prazo' end as motivo
             from public.testes
            where status = 'ativo' and (fim < now() or tokens_usados >= limite_tokens)
  loop
    perform public.encerrar_teste(r.id, r.motivo);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.registrar_uso(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.encerrar_teste(uuid, text) from public, anon, authenticated;
revoke execute on function public.expirar_testes() from public, anon, authenticated;
grant execute on function public.registrar_uso(uuid, text, int) to service_role;
grant execute on function public.encerrar_teste(uuid, text) to service_role;
grant execute on function public.expirar_testes() to service_role;

select cron.schedule('candydate-expirar-testes', '7 * * * *', 'select public.expirar_testes()');
