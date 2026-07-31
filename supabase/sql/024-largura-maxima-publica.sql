-- =====================================================================
-- 024 - Largura máxima global do sistema (também nas páginas públicas)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

create table if not exists public.app_layout_settings (
  id boolean primary key default true,
  layout_max_width integer not null default 1280,
  updated_at timestamptz not null default now(),
  constraint app_layout_settings_singleton check (id),
  constraint app_layout_settings_range
    check (layout_max_width between 960 and 1920)
);

grant select on public.app_layout_settings to anon, authenticated;
grant all on public.app_layout_settings to service_role;

alter table public.app_layout_settings enable row level security;

drop policy if exists "app_layout_settings_select_all" on public.app_layout_settings;
create policy "app_layout_settings_select_all"
on public.app_layout_settings for select to anon, authenticated
using (true);

-- Valor inicial: aproveita a preferência já salva por algum usuário, se houver
insert into public.app_layout_settings (id, layout_max_width)
values (
  true,
  coalesce(
    (select layout_max_width from public.user_settings order by updated_at desc limit 1),
    1280
  )
)
on conflict (id) do nothing;

-- Leitura pública (landing pages, login, etc.)
create or replace function public.get_layout_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select jsonb_build_object('layout_max_width', s.layout_max_width)
       from public.app_layout_settings s where s.id),
    jsonb_build_object('layout_max_width', 1280)
  );
$$;

grant execute on function public.get_layout_settings() to anon, authenticated;

-- Gravação (apenas admin ou quem tem edição em Configurações)
create or replace function public.save_layout_settings(_layout_max_width integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not (public.is_admin() or public.can('configuracoes', 'edit')) then
    raise exception 'Sem permissão para alterar as configurações de layout';
  end if;

  if _layout_max_width is null or _layout_max_width < 960 or _layout_max_width > 1920 then
    raise exception 'Largura máxima inválida (960 a 1920)';
  end if;

  insert into public.app_layout_settings (id, layout_max_width, updated_at)
  values (true, _layout_max_width, now())
  on conflict (id) do update
    set layout_max_width = excluded.layout_max_width,
        updated_at = now();

  return jsonb_build_object('ok', true, 'layout_max_width', _layout_max_width);
end;
$$;

grant execute on function public.save_layout_settings(integer) to authenticated;

-- Tempo real
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  execute 'alter table public.app_layout_settings replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'app_layout_settings'
  ) then
    alter publication supabase_realtime add table public.app_layout_settings;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
