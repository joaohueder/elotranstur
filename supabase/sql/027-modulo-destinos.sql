-- =====================================================================
-- 027 - Destinos das viagens (cadastro em Configurações › Destinos)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

create table if not exists public.destinos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  uf text,
  ativo boolean not null default true,
  posicao integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists destinos_nome_unico
  on public.destinos (lower(nome));

grant select on public.destinos to anon;
grant select, insert, update, delete on public.destinos to authenticated;
grant all on public.destinos to service_role;

alter table public.destinos enable row level security;

drop policy if exists destinos_select on public.destinos;
create policy destinos_select on public.destinos
  for select to anon, authenticated using (true);

drop policy if exists destinos_insert on public.destinos;
create policy destinos_insert on public.destinos
  for insert to authenticated
  with check (is_admin() or can('configuracoes', 'edit') or can('viagens', 'edit'));

drop policy if exists destinos_update on public.destinos;
create policy destinos_update on public.destinos
  for update to authenticated
  using (is_admin() or can('configuracoes', 'edit') or can('viagens', 'edit'))
  with check (is_admin() or can('configuracoes', 'edit') or can('viagens', 'edit'));

drop policy if exists destinos_delete on public.destinos;
create policy destinos_delete on public.destinos
  for delete to authenticated
  using (is_admin() or can('configuracoes', 'delete') or can('viagens', 'delete'));

drop trigger if exists destinos_set_updated_at on public.destinos;
create trigger destinos_set_updated_at
before update on public.destinos
for each row execute function public.set_updated_at();

-- Impede excluir destino que já está sendo usado em alguma viagem
create or replace function public.destinos_bloqueia_exclusao_em_uso()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.viagens v where lower(v.destino) = lower(old.nome)) then
    raise exception 'O destino "%" está sendo usado em viagens e não pode ser excluído.', old.nome
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists destinos_bloqueia_exclusao_trg on public.destinos;
create trigger destinos_bloqueia_exclusao_trg
before delete on public.destinos
for each row execute function public.destinos_bloqueia_exclusao_em_uso();

-- Popula com os destinos já usados nas viagens existentes
insert into public.destinos (nome, posicao)
select distinct on (lower(v.destino)) trim(v.destino),
       coalesce((select max(posicao) + 1 from public.destinos), 0)
  from public.viagens v
 where coalesce(trim(v.destino), '') <> ''
   and not exists (
     select 1 from public.destinos d where lower(d.nome) = lower(trim(v.destino))
   );

-- Realtime
alter table public.destinos replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'destinos'
    ) then
      execute 'alter publication supabase_realtime add table public.destinos';
    end if;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
