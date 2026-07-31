-- ELO Transporte e Turismo — 004: corrige "function gen_salt(unknown) does not exist"
-- Causa: a extensão pgcrypto está instalada no schema "extensions" (padrão do Supabase),
-- mas as funções SECURITY DEFINER usam "set search_path = public", então crypt()/gen_salt()
-- não são encontradas.
-- Solução: garantir a extensão e incluir "extensions" no search_path das funções que a usam.
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA.

begin;

create schema if not exists extensions;

-- Garante o pgcrypto e o move para o schema "extensions" (padrão Supabase)
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pgcrypto';

  if v_schema is null then
    create extension pgcrypto with schema extensions;
  elsif v_schema <> 'extensions' then
    execute 'alter extension pgcrypto set schema extensions';
  end if;
end $$;

grant usage on schema extensions to postgres, authenticated, service_role;

-- =========================================================
-- 1) admin_create_user — agora com search_path = public, extensions
-- =========================================================
create or replace function public.admin_create_user(
  _email text,
  _senha text,
  _nome text default null,
  _is_admin boolean default false,
  _ativo boolean default true,
  _permissoes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(_email));
  v_item  record;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem criar usuários' using errcode = '42501';
  end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido' using errcode = '22023';
  end if;
  if _senha is null or length(_senha) < 8 then
    raise exception 'A senha deve ter no mínimo 8 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Já existe um usuário com este e-mail' using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', coalesce(_nome, v_email)),
    now(), now(), '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid::text,
          jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now())
  on conflict do nothing;

  insert into public.profiles (id, email, nome, ativo)
  values (v_uid, v_email, coalesce(_nome, v_email), coalesce(_ativo, true))
  on conflict (id) do update set email = excluded.email, nome = excluded.nome, ativo = excluded.ativo;

  if coalesce(_is_admin, false) then
    insert into public.user_roles (user_id, role) values (v_uid, 'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (v_uid, 'user') on conflict do nothing;
  end if;

  for v_item in select * from jsonb_each(coalesce(_permissoes, '{}'::jsonb)) loop
    insert into public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
    values (
      v_uid, v_item.key,
      coalesce((v_item.value->>'view')::boolean, false),
      coalesce((v_item.value->>'edit')::boolean, false),
      coalesce((v_item.value->>'delete')::boolean, false)
    )
    on conflict (user_id, modulo) do update
      set can_view = excluded.can_view,
          can_edit = excluded.can_edit,
          can_delete = excluded.can_delete,
          updated_at = now();
  end loop;

  return jsonb_build_object('ok', true, 'id', v_uid, 'email', v_email);
end;
$$;

revoke all on function public.admin_create_user(text, text, text, boolean, boolean, jsonb) from public, anon;
grant execute on function public.admin_create_user(text, text, text, boolean, boolean, jsonb) to authenticated;

-- =========================================================
-- 2) admin_save_user — mesma correção (troca de senha)
-- =========================================================
create or replace function public.admin_save_user(
  _user_id uuid,
  _nome text default null,
  _is_admin boolean default null,
  _ativo boolean default null,
  _permissoes jsonb default null,
  _nova_senha text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem alterar usuários' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;

  if _nome is not null then
    update public.profiles set nome = _nome, updated_at = now() where id = _user_id;
  end if;

  if _ativo is not null then
    if _user_id = auth.uid() and _ativo = false then
      raise exception 'Você não pode desativar a própria conta' using errcode = '42501';
    end if;

    update public.profiles set ativo = _ativo, updated_at = now() where id = _user_id;

    if _ativo then
      update auth.users set banned_until = null, updated_at = now() where id = _user_id;
    else
      update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = _user_id;
      delete from auth.sessions where user_id = _user_id;
      delete from auth.refresh_tokens where user_id = _user_id::text;
    end if;
  end if;

  if _is_admin is not null then
    if _user_id = auth.uid() and _is_admin = false then
      raise exception 'Você não pode remover o próprio acesso de administrador' using errcode = '42501';
    end if;
    delete from public.user_roles where user_id = _user_id;
    insert into public.user_roles (user_id, role)
    values (_user_id, case when _is_admin then 'admin'::public.app_role else 'user'::public.app_role end)
    on conflict do nothing;
  end if;

  if _permissoes is not null then
    delete from public.user_permissions where user_id = _user_id;
    for v_item in select * from jsonb_each(_permissoes) loop
      insert into public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
      values (
        _user_id, v_item.key,
        coalesce((v_item.value->>'view')::boolean, false),
        coalesce((v_item.value->>'edit')::boolean, false),
        coalesce((v_item.value->>'delete')::boolean, false)
      );
    end loop;
  end if;

  if _nova_senha is not null and length(_nova_senha) > 0 then
    if length(_nova_senha) < 8 then
      raise exception 'A senha deve ter no mínimo 8 caracteres' using errcode = '22023';
    end if;
    update auth.users
       set encrypted_password = extensions.crypt(_nova_senha, extensions.gen_salt('bf')),
           updated_at = now()
     where id = _user_id;
  end if;

  return jsonb_build_object('ok', true, 'id', _user_id);
end;
$$;

revoke all on function public.admin_save_user(uuid, text, boolean, boolean, jsonb, text) from public, anon;
grant execute on function public.admin_save_user(uuid, text, boolean, boolean, jsonb, text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Diagnóstico: em qual schema está o pgcrypto?
-- select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
