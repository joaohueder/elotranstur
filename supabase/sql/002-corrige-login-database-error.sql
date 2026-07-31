-- =========================================================
-- 002 - Corrige "Database error querying schema" no login
-- =========================================================
-- Causa: o usuário admin foi inserido manualmente em auth.users e as colunas
-- de token do GoTrue ficaram NULL. O GoTrue lê essas colunas como TEXT NOT NULL
-- e falha com 500 / "Database error querying schema" no /auth/v1/token.
--
-- Este script:
--   1) normaliza as colunas de token de TODOS os usuários (NULL -> '')
--   2) garante que a identity de e-mail exista
--   3) reaplica os GRANTs que o GoTrue precisa no schema auth
--   4) garante que o trigger de criação de perfil não quebre o signup
-- Rode no SQL Editor da sua instância auto-hospedada.
-- =========================================================

begin;

-- 1) Colunas de token nunca podem ser NULL para o GoTrue
update auth.users
   set confirmation_token     = coalesce(confirmation_token, ''),
       recovery_token         = coalesce(recovery_token, ''),
       email_change           = coalesce(email_change, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       phone_change           = coalesce(phone_change, ''),
       phone_change_token     = coalesce(phone_change_token, ''),
       reauthentication_token = coalesce(reauthentication_token, ''),
       aud                    = coalesce(aud, 'authenticated'),
       role                   = coalesce(role, 'authenticated')
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null
    or phone_change is null
    or phone_change_token is null
    or reauthentication_token is null
    or aud is null
    or role is null;

-- Coluna existente apenas em versões mais novas do GoTrue
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'users'
       and column_name = 'email_change_token_current'
  ) then
    execute $sql$
      update auth.users
         set email_change_token_current = coalesce(email_change_token_current, '')
       where email_change_token_current is null
    $sql$;
  end if;
end $$;

-- 2) Garante a identity de e-mail do admin (necessária para login por senha)
do $$
declare
  v_uid   uuid;
  v_email text := 'joaohueder@gmail.com';
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    raise notice 'Usuário % não existe. Rode antes o 001-acesso-admin-inicial.sql', v_email;
    return;
  end if;

  if not exists (
    select 1 from auth.identities
     where user_id = v_uid and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- 3) GRANTs que o GoTrue precisa (o reset total pode ter removido)
grant usage on schema auth to supabase_auth_admin;
grant all on all tables in schema auth to supabase_auth_admin;
grant all on all sequences in schema auth to supabase_auth_admin;
grant all on all functions in schema auth to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;

-- 4) O trigger de perfil roda no INSERT em auth.users; se falhar, quebra o signup
grant select, insert, update on public.profiles to supabase_auth_admin;
grant select, insert on public.user_roles to supabase_auth_admin;

commit;

notify pgrst, 'reload schema';

-- =========================================================
-- Diagnóstico (rode separadamente se o erro persistir)
-- =========================================================
-- select id, email, email_confirmed_at, banned_until, aud, role from auth.users;
-- select tgname, tgrelid::regclass from pg_trigger
--  where not tgisinternal and tgrelid::regclass::text like 'auth.%';
