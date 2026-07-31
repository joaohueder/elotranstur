-- =====================================================================
-- 005 - Módulo Configurações · Aba Layout (largura máxima do sistema)
-- Banco: Supabase auto-hospedado
-- =====================================================================

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout_max_width integer not null default 1280,
  updated_at timestamptz not null default now(),
  constraint user_settings_max_width_range
    check (layout_max_width between 960 and 1920)
);

grant select, insert, update, delete on public.user_settings to authenticated;
grant all on public.user_settings to service_role;

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings for select to authenticated
using (user_id = auth.uid());

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own"
on public.user_settings for delete to authenticated
using (user_id = auth.uid());

-- Leitura das configurações do usuário logado
create or replace function public.get_my_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select jsonb_build_object('layout_max_width', s.layout_max_width)
       from public.user_settings s
      where s.user_id = auth.uid()),
    jsonb_build_object('layout_max_width', 1280)
  );
$$;

grant execute on function public.get_my_settings() to authenticated;

-- Gravação das configurações do usuário logado
create or replace function public.save_my_settings(_layout_max_width integer)
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

  if _layout_max_width is null or _layout_max_width < 960 or _layout_max_width > 1920 then
    raise exception 'Largura máxima inválida (960 a 1920)';
  end if;

  insert into public.user_settings (user_id, layout_max_width, updated_at)
  values (v_uid, _layout_max_width, now())
  on conflict (user_id) do update
    set layout_max_width = excluded.layout_max_width,
        updated_at = now();

  return jsonb_build_object('ok', true, 'layout_max_width', _layout_max_width);
end;
$$;

grant execute on function public.save_my_settings(integer) to authenticated;
