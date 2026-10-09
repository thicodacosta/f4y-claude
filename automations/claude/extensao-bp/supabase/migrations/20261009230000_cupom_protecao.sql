-- Proteção dos cupons gratuitos contra uso em série: a função checkout grava
-- um resumo (hash) do IP de cada uso e recusa mais de 3 usos do mesmo cupom
-- pelo mesmo IP em 24 h. CANDYFREE com limite e validade.
alter table public.cupom_usos add column ip_hash text;
create index cupom_usos_ip_idx on public.cupom_usos (cupom, ip_hash, criado_em);

update public.cupons set limite_total = 100, valido_ate = '2026-12-31' where codigo = 'CANDYFREE';
