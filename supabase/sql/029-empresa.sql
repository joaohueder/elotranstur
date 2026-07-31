-- =====================================================================
-- 029 - Dados da empresa (Configurações › Empresa)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

create table if not exists public.app_empresa (
  id boolean primary key default true,
  nome text not null default '',
  whatsapp text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_empresa_singleton check (id)
);

insert into public.app_empresa (id) values (true)
on conflict (id) do nothing;

grant select on public.app_empresa to anon;
grant select, insert, update on public.app_empresa to authenticated;
grant all on public.app_empresa to service_role;

alter table public.app_empresa enable row level security;

drop policy if exists app_empresa_select on public.app_empresa;
create policy app_empresa_select on public.app_empresa
  for select to anon, authenticated using (true);

drop policy if exists app_empresa_update on public.app_empresa;
create policy app_empresa_update on public.app_empresa
  for update to authenticated
  using (is_admin() or can('configuracoes', 'edit'))
  with check (is_admin() or can('configuracoes', 'edit'));

drop trigger if exists app_empresa_set_updated_at on public.app_empresa;
create trigger app_empresa_set_updated_at
before update on public.app_empresa
for each row execute function public.set_updated_at();

-- Salvar dados da empresa
create or replace function public.save_empresa_settings(
  _nome text,
  _whatsapp text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not (public.is_admin() or public.can('configuracoes', 'edit')) then
    raise exception 'Sem permissão para alterar os dados da empresa';
  end if;

  insert into public.app_empresa (id, nome, whatsapp)
  values (true, coalesce(_nome, ''), coalesce(_whatsapp, ''))
  on conflict (id) do update
    set nome = excluded.nome,
        whatsapp = excluded.whatsapp;
end;
$$;

revoke all on function public.save_empresa_settings(text, text) from public;
grant execute on function public.save_empresa_settings(text, text) to authenticated;

-- Realtime
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'app_empresa'
  ) then
    alter publication supabase_realtime add table public.app_empresa;
  end if;
end $$;

alter table public.app_empresa replica identity full;

commit;
