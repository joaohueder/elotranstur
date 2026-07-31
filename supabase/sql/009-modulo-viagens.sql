-- =====================================================================
-- 009 - Módulo Viagens
-- Banco: Supabase auto-hospedado
-- Executar após 008.
-- =====================================================================

begin;

-- Situação da viagem
do $$
begin
  if not exists (select 1 from pg_type where typname = 'viagem_situacao') then
    create type public.viagem_situacao as enum
      ('rascunho', 'ativa', 'fechada', 'concluida', 'cancelada');
  end if;
end $$;

create table if not exists public.viagens (
  id             uuid primary key default gen_random_uuid(),
  destino        text not null,
  data_partida   date not null,
  itens_inclusos text[] not null default '{}',
  situacao       public.viagem_situacao not null default 'rascunho',
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists viagens_data_partida_idx on public.viagens (data_partida);
create index if not exists viagens_situacao_idx on public.viagens (situacao);

grant select, insert, update, delete on public.viagens to authenticated;
grant all on public.viagens to service_role;

alter table public.viagens enable row level security;

drop policy if exists "viagens_select" on public.viagens;
create policy "viagens_select" on public.viagens
for select to authenticated
using (public.is_admin() or public.can('viagens', 'view'));

drop policy if exists "viagens_insert" on public.viagens;
create policy "viagens_insert" on public.viagens
for insert to authenticated
with check (public.is_admin() or public.can('viagens', 'edit'));

drop policy if exists "viagens_update" on public.viagens;
create policy "viagens_update" on public.viagens
for update to authenticated
using (public.is_admin() or public.can('viagens', 'edit'))
with check (public.is_admin() or public.can('viagens', 'edit'));

drop policy if exists "viagens_delete" on public.viagens;
create policy "viagens_delete" on public.viagens
for delete to authenticated
using (public.is_admin() or public.can('viagens', 'delete'));

drop trigger if exists viagens_set_updated_at on public.viagens;
create trigger viagens_set_updated_at
before update on public.viagens
for each row execute function public.set_updated_at();

commit;
