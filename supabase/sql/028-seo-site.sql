-- =====================================================================
-- 028 - Informações de SEO do site (Configurações › Layout)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

alter table public.app_layout_settings
  add column if not exists seo_site_name text not null default 'ELO Transporte e Turismo',
  add column if not exists seo_title text not null default 'ELO Transporte e Turismo',
  add column if not exists seo_description text not null default
    'Viagens, excursões e experiências de turismo com a ELO Transporte e Turismo.',
  add column if not exists seo_image_url text;

-- Leitura pública (landing pages, login, etc.)
create or replace function public.get_layout_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select jsonb_build_object(
              'layout_max_width', s.layout_max_width,
              'seo_site_name', s.seo_site_name,
              'seo_title', s.seo_title,
              'seo_description', s.seo_description,
              'seo_image_url', s.seo_image_url
            )
       from public.app_layout_settings s where s.id),
    jsonb_build_object(
      'layout_max_width', 1280,
      'seo_site_name', 'ELO Transporte e Turismo',
      'seo_title', 'ELO Transporte e Turismo',
      'seo_description', 'Viagens, excursões e experiências de turismo com a ELO Transporte e Turismo.',
      'seo_image_url', null
    )
  );
$$;

grant execute on function public.get_layout_settings() to anon, authenticated;

-- Remove a versão antiga (evita ambiguidade de sobrecarga no PostgREST)
drop function if exists public.save_layout_settings(integer);

create or replace function public.save_layout_settings(
  _layout_max_width integer,
  _seo_site_name text default null,
  _seo_title text default null,
  _seo_description text default null,
  _seo_image_url text default null
)
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

  update public.app_layout_settings
     set seo_site_name = coalesce(nullif(btrim(_seo_site_name), ''), seo_site_name),
         seo_title = coalesce(nullif(btrim(_seo_title), ''), seo_title),
         seo_description = coalesce(nullif(btrim(_seo_description), ''), seo_description),
         seo_image_url = nullif(btrim(coalesce(_seo_image_url, '')), ''),
         updated_at = now()
   where id;

  return (select jsonb_build_object(
            'ok', true,
            'layout_max_width', s.layout_max_width,
            'seo_site_name', s.seo_site_name,
            'seo_title', s.seo_title,
            'seo_description', s.seo_description,
            'seo_image_url', s.seo_image_url)
          from public.app_layout_settings s where s.id);
end;
$$;

grant execute on function public.save_layout_settings(integer, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
