-- =====================================================================
-- 032 - Configurações › Integração › Meta Ads (Pixel + API de Conversões)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

create table if not exists public.app_meta_ads (
  id boolean primary key default true,
  pixel_id text not null default '',
  access_token text not null default '',
  test_event_code text not null default '',
  ativo boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint app_meta_ads_singleton check (id)
);

insert into public.app_meta_ads (id) values (true)
on conflict (id) do nothing;

grant select, insert, update on public.app_meta_ads to authenticated;
grant all on public.app_meta_ads to service_role;

alter table public.app_meta_ads enable row level security;
-- Sem policies: o acesso é somente pelas funções SECURITY DEFINER abaixo.

-- ---------------------------------------------------------------------
-- Leitura pública: apenas o ID do Pixel (dado público, usado no browser).
-- ---------------------------------------------------------------------
create or replace function public.meta_ads_public()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pixel_id', case when ativo then pixel_id else '' end,
    'ativo', ativo
  )
  from public.app_meta_ads
  where id;
$$;

grant execute on function public.meta_ads_public() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Leitura administrativa (token nunca é devolvido, só o "definido").
-- ---------------------------------------------------------------------
create or replace function public.get_meta_ads_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.app_meta_ads;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: somente administradores';
  end if;

  select * into v from public.app_meta_ads where id;

  if not found then
    return jsonb_build_object(
      'pixel_id', '', 'access_token_set', false,
      'test_event_code', '', 'ativo', false
    );
  end if;

  return jsonb_build_object(
    'pixel_id', v.pixel_id,
    'access_token_set', coalesce(v.access_token, '') <> '',
    'test_event_code', v.test_event_code,
    'ativo', v.ativo,
    'updated_at', v.updated_at
  );
end;
$$;

grant execute on function public.get_meta_ads_settings() to authenticated;

-- ---------------------------------------------------------------------
-- Gravação (passe _access_token = null para manter o token atual).
-- ---------------------------------------------------------------------
create or replace function public.save_meta_ads_settings(
  _pixel_id text,
  _access_token text,
  _test_event_code text,
  _ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: somente administradores';
  end if;

  insert into public.app_meta_ads (id, pixel_id, access_token, test_event_code, ativo, updated_at, updated_by)
  values (
    true,
    coalesce(_pixel_id, ''),
    coalesce(_access_token, ''),
    coalesce(_test_event_code, ''),
    coalesce(_ativo, false),
    now(),
    auth.uid()
  )
  on conflict (id) do update set
    pixel_id = excluded.pixel_id,
    access_token = case
      when _access_token is null or _access_token = '' then public.app_meta_ads.access_token
      else _access_token
    end,
    test_event_code = excluded.test_event_code,
    ativo = excluded.ativo,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

grant execute on function public.save_meta_ads_settings(text, text, text, boolean) to authenticated;

commit;
