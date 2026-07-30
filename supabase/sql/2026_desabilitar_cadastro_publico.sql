-- =====================================================================
-- ELO Transporte e Turismo
-- Desabilitar cadastro publico (self-hosted Supabase)
-- =====================================================================
-- PASSO 1 (obrigatorio, fora do SQL): na sua instancia auto-hospedada,
-- defina no .env do GoTrue/docker-compose:
--
--   GOTRUE_DISABLE_SIGNUP=true
--   GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false
--
-- e reinicie os servicos (docker compose up -d auth).
-- Isso bloqueia o endpoint publico /auth/v1/signup para qualquer visitante.
--
-- PASSO 2: com o signup publico desligado, a criacao de contas passa a ser
-- feita apenas por administradores autenticados, atraves do RPC abaixo.
-- =====================================================================

create extension if not exists pgcrypto;

create or replace function public.admin_create_user(
  _email text,
  _senha text,
  _nome text default null,
  _role public.app_role default 'usuario'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  _uid uuid := gen_random_uuid();
  _mail text := lower(trim(_email));
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem criar usuarios';
  end if;

  if _mail is null or _mail = '' or position('@' in _mail) = 0 then
    raise exception 'E-mail invalido';
  end if;

  if _senha is null or length(_senha) < 8 then
    raise exception 'A senha precisa ter ao menos 8 caracteres';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = _mail) then
    raise exception 'Ja existe um usuario com este e-mail';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
    _mail, crypt(_senha, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('nome', coalesce(nullif(trim(_nome), ''), _mail)),
    now(), now()
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), _uid, _uid::text,
    jsonb_build_object('sub', _uid::text, 'email', _mail, 'email_verified', true),
    'email', null, now(), now()
  );

  insert into public.profiles (id, email, nome, ativo)
  values (_uid, _mail, coalesce(nullif(trim(_nome), ''), _mail), true)
  on conflict (id) do update
    set email = excluded.email, nome = excluded.nome, ativo = true;

  delete from public.user_roles where user_id = _uid;
  insert into public.user_roles (user_id, role) values (_uid, _role);

  return _uid;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, public.app_role) from public, anon;
grant execute on function public.admin_create_user(text, text, text, public.app_role) to authenticated;

notify pgrst, 'reload schema';
