-- =====================================================================
-- 041 - Módulo Dashboard: registro de visitas das páginas públicas
-- =====================================================================
begin;

create table if not exists public.site_visitas (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  path text not null default '/',
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists site_visitas_created_at_idx on public.site_visitas (created_at desc);
create index if not exists site_visitas_visitor_idx on public.site_visitas (visitor_id, created_at desc);

grant select on public.site_visitas to authenticated;
grant all on public.site_visitas to service_role;

alter table public.site_visitas enable row level security;

drop policy if exists "visitas legiveis autenticados" on public.site_visitas;
create policy "visitas legiveis autenticados"
  on public.site_visitas for select
  to authenticated
  using (true);

-- Registro de visita (chamado pelas páginas públicas, sem login).
create or replace function public.registrar_visita(
  _visitor text,
  _path text default '/',
  _referrer text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _visitor is null or length(_visitor) < 4 then
    return;
  end if;

  -- Evita gravar batidas repetidas do mesmo visitante/página em menos de 1 minuto.
  if exists (
    select 1 from public.site_visitas v
    where v.visitor_id = _visitor
      and v.path = coalesce(_path, '/')
      and v.created_at > now() - interval '1 minute'
  ) then
    return;
  end if;

  insert into public.site_visitas (visitor_id, path, referrer)
  values (_visitor, coalesce(_path, '/'), _referrer);
end;
$$;

revoke all on function public.registrar_visita(text, text, text) from public;
grant execute on function public.registrar_visita(text, text, text) to anon, authenticated;

-- Métricas de visitas para o Dashboard.
create or replace function public.dashboard_visitas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if not (public.is_admin() or public.can('dashboard', 'view')) then
    raise exception 'Sem permissão para o módulo Dashboard';
  end if;

  select jsonb_build_object(
    'online', (
      select count(distinct visitor_id) from public.site_visitas
      where created_at > now() - interval '3 minutes'
    ),
    'dia_unica', (
      select count(distinct visitor_id) from public.site_visitas
      where created_at >= date_trunc('day', now())
    ),
    'dia_total', (
      select count(*) from public.site_visitas
      where created_at >= date_trunc('day', now())
    ),
    'mes_unica', (
      select count(distinct visitor_id) from public.site_visitas
      where created_at >= date_trunc('month', now())
    ),
    'mes_total', (
      select count(*) from public.site_visitas
      where created_at >= date_trunc('month', now())
    ),
    'semana', (
      select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) from (
        select
          d::date as dia,
          (select count(distinct s.visitor_id) from public.site_visitas s
             where s.created_at >= d and s.created_at < d + interval '1 day') as unica,
          (select count(*) from public.site_visitas s
             where s.created_at >= d and s.created_at < d + interval '1 day') as total
        from generate_series(date_trunc('day', now()) - interval '6 days',
                             date_trunc('day', now()), interval '1 day') d
      ) x
    )
  ) into v;

  return v;
end;
$$;

revoke all on function public.dashboard_visitas() from public, anon;
grant execute on function public.dashboard_visitas() to authenticated;

commit;
