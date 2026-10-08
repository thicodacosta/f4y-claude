-- Telefone do colaborador (cadastro e importação em massa nas Configurações).
alter table public.bp_colaboradores
  add column telefone text check (telefone is null or char_length(telefone) <= 30);
