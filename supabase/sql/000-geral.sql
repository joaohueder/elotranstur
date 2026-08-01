-- ELO Transporte e Turismo — SQL GERAL (schema completo do banco)
-- Gerado a partir de 001-acesso-admin-inicial.sql + 002 + 003-modulo-usuarios.sql

-- ELO Transporte e Turismo — 001: acesso inicial (papéis + primeiro admin)
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA do Supabase.
-- Requisito: extensão pgcrypto (já vem habilitada no Supabase).

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1) Enum de papéis
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user');
  end if;
end $$;

-- =========================================================
-- 2) Perfis
-- =========================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nome        text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

-- =========================================================
-- 3) Papéis do usuário (SEMPRE em tabela separada)
-- =========================================================
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- =========================================================
-- 4) Função de checagem de papel (SECURITY DEFINER, evita recursão em RLS)
-- =========================================================
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- =========================================================
-- 5) Políticas RLS
-- =========================================================
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles for insert to authenticated
  with check (public.is_admin());

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
  on public.profiles for delete to authenticated
  using (public.is_admin());

drop policy if exists "user_roles_select_self_or_admin" on public.user_roles;
create policy "user_roles_select_self_or_admin"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Escrita em user_roles: apenas service_role (bypassa RLS). Nenhuma policy de
-- insert/update/delete para authenticated = ninguém escalona o próprio papel.

-- =========================================================
-- 6) Trigger: cria perfil automaticamente para novos usuários
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 7) Primeiro usuário ADMIN
-- =========================================================
do $$
declare
  v_uid   uuid;
  v_email text := 'joaohueder@gmail.com';
  v_senha text := '123456789';
begin
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt(v_senha, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', 'João Hueder'),
      now(), now()
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt(v_senha, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until       = null,
           updated_at         = now()
     where id = v_uid;
  end if;

  insert into public.profiles (id, email, nome, ativo)
  values (v_uid, v_email, 'João Hueder', true)
  on conflict (id) do update set ativo = true, updated_at = now();

  insert into public.user_roles (user_id, role)
  values (v_uid, 'admin')
  on conflict (user_id, role) do nothing;
end $$;

commit;

-- 8) Recarrega o cache do PostgREST
notify pgrst, 'reload schema';
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
-- ELO Transporte e Turismo — 003: módulo de usuários (CRUD + permissões)
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA do Supabase.
-- Depende de: 001-acesso-admin-inicial.sql

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1) Tabela de permissões por módulo
-- =========================================================
create table if not exists public.user_permissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  modulo     text not null,
  can_view   boolean not null default false,
  can_edit   boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, modulo)
);

grant select on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;

alter table public.user_permissions enable row level security;

drop policy if exists "user_permissions_select_self_or_admin" on public.user_permissions;
create policy "user_permissions_select_self_or_admin"
  on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Escrita apenas via RPCs SECURITY DEFINER abaixo (nenhuma policy de write).

-- =========================================================
-- 2) Permissão efetiva do usuário logado (admin tem tudo)
-- =========================================================
create or replace function public.can(_modulo text, _acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.has_role(auth.uid(), 'admin') then true
    else coalesce((
      select case _acao
        when 'view'   then p.can_view
        when 'edit'   then p.can_edit
        when 'delete' then p.can_delete
        else false
      end
      from public.user_permissions p
      where p.user_id = auth.uid() and p.modulo = _modulo
    ), false)
  end;
$$;

revoke all on function public.can(text, text) from public, anon;
grant execute on function public.can(text, text) to authenticated;

-- =========================================================
-- 3) Listagem de usuários (admin ou quem tem view em "usuarios")
-- =========================================================
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not (public.is_admin() or public.can('usuarios', 'view')) then
    raise exception 'Sem permissão para listar usuários' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(u order by u.email), '[]'::jsonb) into v_result
  from (
    select
      p.id,
      p.email,
      p.nome,
      p.ativo,
      p.created_at,
      au.last_sign_in_at,
      coalesce(public.has_role(p.id, 'admin'), false) as is_admin,
      s.created_at as sessao_iniciada_em,
      s.refreshed_at as sessao_atualizada_em,
      host(s.ip) as sessao_ip,
      s.user_agent as sessao_user_agent,
      (s.id is not null) as online,
      coalesce((
        select jsonb_object_agg(
          up.modulo,
          jsonb_build_object('view', up.can_view, 'edit', up.can_edit, 'delete', up.can_delete)
        )
        from public.user_permissions up where up.user_id = p.id
      ), '{}'::jsonb) as permissoes
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join lateral (
      select se.id, se.created_at, se.refreshed_at, se.ip, se.user_agent
      from auth.sessions se
      where se.user_id = p.id
        and (se.not_after is null or se.not_after > now())
      order by se.created_at desc
      limit 1
    ) s on true
  ) u;

  return v_result;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- =========================================================
-- Forçar logoff (admin ou quem tem edit em "usuarios")
-- =========================================================
create or replace function public.admin_force_logout(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.can('usuarios', 'edit')) then
    raise exception 'Sem permissão para encerrar sessões de usuários' using errcode = '42501';
  end if;

  -- Somente administradores podem derrubar outro administrador
  if public.has_role(_user_id, 'admin') and not public.is_admin() then
    raise exception 'Somente administradores podem encerrar a sessão de um administrador'
      using errcode = '42501';
  end if;

  delete from auth.refresh_tokens where session_id in (
    select id from auth.sessions where user_id = _user_id
  );
  delete from auth.sessions where user_id = _user_id;
end;
$$;

revoke all on function public.admin_force_logout(uuid) from public, anon;
grant execute on function public.admin_force_logout(uuid) to authenticated;


-- =========================================================
-- 4) Criar usuário (somente admin) — sem cadastro público
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
set search_path = public
as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(_email));
  v_item  record;
begin
  if not (public.is_admin() or public.can('usuarios', 'edit')) then
    raise exception 'Você não tem permissão para criar usuários' using errcode = '42501';
  end if;

  if coalesce(_is_admin, false) and not public.is_admin() then
    raise exception 'Somente administradores podem criar outros administradores' using errcode = '42501';
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
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, crypt(_senha, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', coalesce(_nome, v_email)),
    now(), now(), '', '', '', ''
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
-- 5) Salvar usuário (dados, papel, ativação, permissões, senha)
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
set search_path = public
as $$
declare
  v_item record;
  v_sou_admin boolean := public.is_admin();
  v_alvo_admin boolean;
begin
  if not (v_sou_admin or public.can('usuarios', 'edit')) then
    raise exception 'Você não tem permissão para alterar usuários' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;

  v_alvo_admin := public.has_role(_user_id, 'admin');

  if not v_sou_admin then
    if v_alvo_admin then
      raise exception 'Somente administradores podem alterar contas de administrador' using errcode = '42501';
    end if;
    if _is_admin is not null and _is_admin then
      raise exception 'Somente administradores podem conceder acesso de administrador' using errcode = '42501';
    end if;
  end if;

  if _nome is not null then
    update public.profiles set nome = _nome, updated_at = now() where id = _user_id;
  end if;

  if _ativo is not null then
    -- impede o admin de desativar a própria conta
    if _user_id = auth.uid() and _ativo = false then
      raise exception 'Você não pode desativar a própria conta' using errcode = '42501';
    end if;

    update public.profiles set ativo = _ativo, updated_at = now() where id = _user_id;

    -- bloqueia autenticação e revoga sessões quando desativado
    if _ativo then
      update auth.users set banned_until = null, updated_at = now() where id = _user_id;
    else
      update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = _user_id;
      delete from auth.sessions where user_id = _user_id;
      delete from auth.refresh_tokens where user_id = _user_id::text;
    end if;
  end if;

  if _is_admin is not null then
    -- só bloqueia quando o próprio usuário É admin e está tentando se rebaixar
    if _user_id = auth.uid() and _is_admin = false and v_alvo_admin then
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
       set encrypted_password = crypt(_nova_senha, gen_salt('bf')), updated_at = now()
     where id = _user_id;
  end if;

  return jsonb_build_object('ok', true, 'id', _user_id);
end;
$$;

revoke all on function public.admin_save_user(uuid, text, boolean, boolean, jsonb, text) from public, anon;
grant execute on function public.admin_save_user(uuid, text, boolean, boolean, jsonb, text) to authenticated;

-- =========================================================
-- 6) Excluir usuário
-- =========================================================
create or replace function public.admin_delete_user(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.can('usuarios', 'delete')) then
    raise exception 'Você não tem permissão para excluir usuários' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta' using errcode = '42501';
  end if;
  if public.has_role(_user_id, 'admin') and not public.is_admin() then
    raise exception 'Somente administradores podem excluir contas de administrador' using errcode = '42501';
  end if;

  delete from auth.users where id = _user_id;
  return jsonb_build_object('ok', true, 'id', _user_id);
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- =========================================================
-- 7) Perfil + permissões do usuário logado (para montar o menu)
-- =========================================================
create or replace function public.me()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', v_uid,
    'email', (select email from public.profiles where id = v_uid),
    'nome', (select nome from public.profiles where id = v_uid),
    'ativo', coalesce((select ativo from public.profiles where id = v_uid), true),
    'is_admin', public.has_role(v_uid, 'admin'),
    'permissoes', coalesce((
      select jsonb_object_agg(modulo, jsonb_build_object('view', can_view, 'edit', can_edit, 'delete', can_delete))
      from public.user_permissions where user_id = v_uid
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.me() from public, anon;
grant execute on function public.me() to authenticated;

commit;


-- =====================================================================
-- MÓDULO CRM (Kanban) — ver supabase/sql/007-modulo-crm-kanban.sql
-- =====================================================================
-- =====================================================================
-- 007 - Módulo CRM (Kanban) · Etapas e Leads
-- Banco: Supabase auto-hospedado
-- Executar após 006.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Etapas do funil (colunas do kanban)
-- ---------------------------------------------------------------------
create table if not exists public.crm_stages (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cor         text not null default '#64748b',
  posicao     integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.crm_stages to authenticated;
grant all on public.crm_stages to service_role;

alter table public.crm_stages enable row level security;

drop policy if exists "crm_stages_select" on public.crm_stages;
create policy "crm_stages_select" on public.crm_stages
for select to authenticated
using (public.is_admin() or public.can('crm', 'view'));

drop policy if exists "crm_stages_insert" on public.crm_stages;
create policy "crm_stages_insert" on public.crm_stages
for insert to authenticated
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_stages_update" on public.crm_stages;
create policy "crm_stages_update" on public.crm_stages
for update to authenticated
using (public.is_admin() or public.can('crm', 'edit'))
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_stages_delete" on public.crm_stages;
create policy "crm_stages_delete" on public.crm_stages
for delete to authenticated
using (public.is_admin() or public.can('crm', 'delete'));

-- ---------------------------------------------------------------------
-- 2) Leads
-- ---------------------------------------------------------------------
create table if not exists public.crm_leads (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  whatsapp    text not null,
  origem      text not null default 'Outros',
  stage_id    uuid references public.crm_stages(id) on delete set null,
  posicao     integer not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists crm_leads_stage_idx on public.crm_leads (stage_id, posicao);

grant select, insert, update, delete on public.crm_leads to authenticated;
grant all on public.crm_leads to service_role;

alter table public.crm_leads enable row level security;

drop policy if exists "crm_leads_select" on public.crm_leads;
create policy "crm_leads_select" on public.crm_leads
for select to authenticated
using (public.is_admin() or public.can('crm', 'view'));

drop policy if exists "crm_leads_insert" on public.crm_leads;
create policy "crm_leads_insert" on public.crm_leads
for insert to authenticated
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_leads_update" on public.crm_leads;
create policy "crm_leads_update" on public.crm_leads
for update to authenticated
using (public.is_admin() or public.can('crm', 'edit'))
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_leads_delete" on public.crm_leads;
create policy "crm_leads_delete" on public.crm_leads
for delete to authenticated
using (public.is_admin() or public.can('crm', 'delete'));

-- ---------------------------------------------------------------------
-- 3) Trigger de updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_stages_set_updated_at on public.crm_stages;
create trigger crm_stages_set_updated_at
before update on public.crm_stages
for each row execute function public.set_updated_at();

drop trigger if exists crm_leads_set_updated_at on public.crm_leads;
create trigger crm_leads_set_updated_at
before update on public.crm_leads
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4) Etapas iniciais (somente se ainda não houver nenhuma)
-- ---------------------------------------------------------------------
insert into public.crm_stages (nome, cor, posicao)
select * from (values
  ('Novo lead',   '#64748b', 0),
  ('Em contato',  '#2563eb', 1),
  ('Proposta',    '#d97706', 2),
  ('Fechado',     '#16a34a', 3),
  ('Perdido',     '#dc2626', 4)
) as v(nome, cor, posicao)
where not exists (select 1 from public.crm_stages);

commit;
-- =====================================================================
-- 008 - CRM · Origens dos leads (configuráveis)
-- Banco: Supabase auto-hospedado
-- Executar após 007.
-- =====================================================================

begin;

create table if not exists public.crm_origens (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  posicao     integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.crm_origens to authenticated;
grant all on public.crm_origens to service_role;

alter table public.crm_origens enable row level security;

drop policy if exists "crm_origens_select" on public.crm_origens;
create policy "crm_origens_select" on public.crm_origens
for select to authenticated
using (public.is_admin() or public.can('crm', 'view'));

drop policy if exists "crm_origens_insert" on public.crm_origens;
create policy "crm_origens_insert" on public.crm_origens
for insert to authenticated
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_origens_update" on public.crm_origens;
create policy "crm_origens_update" on public.crm_origens
for update to authenticated
using (public.is_admin() or public.can('crm', 'edit'))
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_origens_delete" on public.crm_origens;
create policy "crm_origens_delete" on public.crm_origens
for delete to authenticated
using (public.is_admin() or public.can('crm', 'delete'));

drop trigger if exists crm_origens_set_updated_at on public.crm_origens;
create trigger crm_origens_set_updated_at
before update on public.crm_origens
for each row execute function public.set_updated_at();

-- Origens iniciais (somente se ainda não houver nenhuma)
insert into public.crm_origens (nome, posicao)
select * from (values
  ('WhatsApp',  0),
  ('Instagram', 1),
  ('Facebook',  2),
  ('Site',      3),
  ('Indicação', 4),
  ('Telefone',  5),
  ('Outros',    6)
) as v(nome, posicao)
where not exists (select 1 from public.crm_origens);

commit;

-- Situação da viagem
do $$
begin
  if not exists (select 1 from pg_type where typname = 'viagem_situacao') then
    create type public.viagem_situacao as enum
      ('rascunho', 'ativa', 'fechada', 'concluida', 'cancelada');
  end if;
end $$;

create table if not exists public.viagens (
  id             uuid primary key default gen_random_uuid(),
  destino        text not null,
  data_partida   date not null,
  itens_inclusos text[] not null default '{}',
  situacao       public.viagem_situacao not null default 'rascunho',
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists viagens_data_partida_idx on public.viagens (data_partida);
create index if not exists viagens_situacao_idx on public.viagens (situacao);

grant select, insert, update, delete on public.viagens to authenticated;
grant all on public.viagens to service_role;

alter table public.viagens enable row level security;

drop policy if exists "viagens_select" on public.viagens;
create policy "viagens_select" on public.viagens
for select to authenticated
using (public.is_admin() or public.can('viagens', 'view'));

drop policy if exists "viagens_insert" on public.viagens;
create policy "viagens_insert" on public.viagens
for insert to authenticated
with check (public.is_admin() or public.can('viagens', 'edit'));

drop policy if exists "viagens_update" on public.viagens;
create policy "viagens_update" on public.viagens
for update to authenticated
using (public.is_admin() or public.can('viagens', 'edit'))
with check (public.is_admin() or public.can('viagens', 'edit'));

drop policy if exists "viagens_delete" on public.viagens;
create policy "viagens_delete" on public.viagens
for delete to authenticated
using (public.is_admin() or public.can('viagens', 'delete'));

drop trigger if exists viagens_set_updated_at on public.viagens;
create trigger viagens_set_updated_at
before update on public.viagens
for each row execute function public.set_updated_at();


commit;

alter table public.viagens
  add column if not exists valor numeric(12,2) not null default 0;

-- 012 - Viagens: horário, textos, vagas e galeria de imagens
alter table public.viagens
  add column if not exists hora_partida time,
  add column if not exists titulo       text,
  add column if not exists subtitulo    text,
  add column if not exists descricao    text,
  add column if not exists vagas        integer not null default 0,
  add column if not exists imagens      jsonb not null default '[]'::jsonb;

alter table public.viagens drop constraint if exists viagens_vagas_nao_negativa;
alter table public.viagens add constraint viagens_vagas_nao_negativa check (vagas >= 0);

insert into storage.buckets (id, name, public)
values ('viagens', 'viagens', true)
on conflict (id) do update set public = true;

drop policy if exists "viagens_imgs_public_read" on storage.objects;
create policy "viagens_imgs_public_read" on storage.objects
for select to public using (bucket_id = 'viagens');

drop policy if exists "viagens_imgs_insert" on storage.objects;
create policy "viagens_imgs_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'viagens' and (public.is_admin() or public.can('viagens','edit')));

drop policy if exists "viagens_imgs_update" on storage.objects;
create policy "viagens_imgs_update" on storage.objects
for update to authenticated
using (bucket_id = 'viagens' and (public.is_admin() or public.can('viagens','edit')));

drop policy if exists "viagens_imgs_delete" on storage.objects;
create policy "viagens_imgs_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'viagens' and (public.is_admin() or public.can('viagens','delete') or public.can('viagens','edit')));

-- ===== 015 - MÓDULO LEADS (ver supabase/sql/015-modulo-leads.sql) =====
-- =====================================================================
-- 015 - MÓDULO LEADS
-- Cria o módulo "leads" (listagem completa dos leads do CRM) e libera
-- o acesso às tabelas do CRM também para quem tem permissão em "leads".
-- =====================================================================

-- 1) Políticas: aceitar permissão do módulo 'crm' OU do módulo 'leads'
--    nas tabelas usadas pela tela de leads.

-- crm_leads -----------------------------------------------------------
DROP POLICY IF EXISTS crm_leads_select ON public.crm_leads;
CREATE POLICY crm_leads_select ON public.crm_leads
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_leads_insert ON public.crm_leads;
CREATE POLICY crm_leads_insert ON public.crm_leads
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_leads_update ON public.crm_leads;
CREATE POLICY crm_leads_update ON public.crm_leads
  FOR UPDATE TO authenticated
  USING (is_admin() OR can('crm','edit') OR can('leads','edit'))
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_leads_delete ON public.crm_leads;
CREATE POLICY crm_leads_delete ON public.crm_leads
  FOR DELETE TO authenticated
  USING (is_admin() OR can('crm','delete') OR can('leads','delete'));

-- crm_lead_viagens ----------------------------------------------------
DROP POLICY IF EXISTS crm_lead_viagens_select ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_select ON public.crm_lead_viagens
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_lead_viagens_insert ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_insert ON public.crm_lead_viagens
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_viagens_update ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_update ON public.crm_lead_viagens
  FOR UPDATE TO authenticated
  USING (is_admin() OR can('crm','edit') OR can('leads','edit'))
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_viagens_delete ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_delete ON public.crm_lead_viagens
  FOR DELETE TO authenticated
  USING (is_admin() OR can('crm','delete') OR can('leads','delete'));

-- crm_lead_notas ------------------------------------------------------
DROP POLICY IF EXISTS crm_lead_notas_select ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_select ON public.crm_lead_notas
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_lead_notas_insert ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_insert ON public.crm_lead_notas
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_notas_update ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_update ON public.crm_lead_notas
  FOR UPDATE TO authenticated
  USING (is_admin() OR can('crm','edit') OR can('leads','edit'))
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_notas_delete ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_delete ON public.crm_lead_notas
  FOR DELETE TO authenticated
  USING (is_admin() OR can('crm','delete') OR can('leads','delete'));

-- crm_stages / crm_origens (leitura para montar filtros e o formulário)
DROP POLICY IF EXISTS crm_stages_select ON public.crm_stages;
CREATE POLICY crm_stages_select ON public.crm_stages
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_origens_select ON public.crm_origens;
CREATE POLICY crm_origens_select ON public.crm_origens
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

-- viagens: necessário para listar as viagens de interesse do lead
DROP POLICY IF EXISTS viagens_select ON public.viagens;
CREATE POLICY viagens_select ON public.viagens
  FOR SELECT TO authenticated
  USING (is_admin() OR can('viagens','view') OR can('crm','view') OR can('leads','view'));

-- 2) Cria a linha de permissão do módulo 'leads' para usuários existentes
INSERT INTO public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
SELECT p.id, 'leads', false, false, false
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up
  WHERE up.user_id = p.id AND up.modulo = 'leads'
);

-- =====================================================================
-- LANDING PAGES DE VIAGENS (ver 016-landing-pages.sql)
-- =====================================================================
alter table public.viagens
  add column if not exists landing_modelo text    not null default 'aurora',
  add column if not exists landing_paleta text    not null default 'areia-dourada',
  add column if not exists landing_slug   text,
  add column if not exists landing_ativa  boolean not null default true;

create unique index if not exists viagens_landing_slug_uidx
  on public.viagens (landing_slug) where landing_slug is not null;

-- Funções públicas landing_viagem(text) e landing_lead(text,text,text):
-- ver arquivo supabase/sql/016-landing-pages.sql (execute-o na íntegra).

-- Remove a assinatura antiga com o parâmetro mensagem. Manter duas
-- assinaturas causa o erro PGRST203 ao enviar o formulário público.
drop function if exists public.landing_lead(text, text, text, text);
-- ============================================================
-- 023 - Atualização em tempo real (Realtime) para todo o sistema
-- Idempotente: pode ser executado várias vezes com segurança.
-- ============================================================

begin;

-- Garante que a publicação usada pelo Realtime exista
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

-- Adiciona as tabelas do sistema à publicação e garante o envio
-- dos dados completos das linhas (necessário para UPDATE/DELETE).
do $$
declare
  t text;
  tabelas text[] := array[
    'profiles',
    'user_roles',
    'user_permissions',
    'user_settings',
    'app_email_settings',
    'viagens',
    'crm_stages',
    'crm_origens',
    'crm_leads',
    'crm_lead_viagens',
    'crm_lead_notas'
  ];
begin
  foreach t in array tabelas loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I replica identity full', t);

      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
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
-- =====================================================================
-- 025 - Garante Realtime nas tabelas do CRM (leads vindos da landing page)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'crm_leads', 'crm_stages', 'crm_origens', 'crm_lead_viagens',
    'crm_lead_notas', 'viagens', 'app_layout_settings'
  ] loop
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      execute format('alter table public.%I replica identity full', t);
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end if;
  end loop;
end;
$$;

-- O Realtime valida RLS com o papel do assinante: usuários logados precisam
-- conseguir ler os leads para receberem os eventos.
grant select on public.crm_leads to authenticated;
grant select on public.crm_lead_viagens to authenticated;

notify pgrst, 'reload schema';

-- Conferência rápida (deve listar as tabelas acima):
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- =====================================================================
-- 026 - Origens de lead usadas pelo sistema (protegidas)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

alter table public.crm_origens
  add column if not exists sistema boolean not null default false;

-- Origens criadas/usadas pelo próprio sistema
update public.crm_origens
   set sistema = true, ativo = true
 where nome in ('Landing Page');

-- Bloqueia edição (nome/ativo/sistema) das origens de sistema.
-- A posição continua livre para permitir reordenar a lista.
create or replace function public.crm_origens_protege_sistema()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'DELETE' then
    if old.sistema then
      raise exception 'A origem "%" é usada pelo sistema e não pode ser excluída.', old.nome
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.sistema then
    if new.nome is distinct from old.nome
       or new.ativo is distinct from old.ativo
       or new.sistema is distinct from old.sistema then
      raise exception 'A origem "%" é usada pelo sistema e não pode ser alterada.', old.nome
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_origens_protege_sistema_trg on public.crm_origens;
create trigger crm_origens_protege_sistema_trg
before update or delete on public.crm_origens
for each row execute function public.crm_origens_protege_sistema();

-- Garante que a origem da landing page exista e esteja marcada
insert into public.crm_origens (nome, ativo, sistema, posicao)
select 'Landing Page', true, true,
       coalesce((select max(posicao) + 1 from public.crm_origens), 0)
where not exists (select 1 from public.crm_origens where nome = 'Landing Page');

notify pgrst, 'reload schema';

commit;

-- =====================================================================
-- 027 - Destinos das viagens (cadastro em Configurações › Destinos)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================


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
declare
  v_qtd integer;
begin
  select count(*) into v_qtd
    from public.viagens v
   where lower(btrim(v.destino)) in (
     lower(btrim(old.nome)),
     lower(btrim(old.nome)) || ' - ' || lower(btrim(coalesce(old.uf, ''))),
     lower(btrim(old.nome)) || '/' || lower(btrim(coalesce(old.uf, ''))),
     lower(btrim(old.nome)) || ' ' || lower(btrim(coalesce(old.uf, '')))
   );
  if v_qtd > 0 then
    raise exception
      'O destino "%" está sendo usado em % viagem(ns) e não pode ser excluído.',
      old.nome, v_qtd
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists destinos_bloqueia_exclusao_trg on public.destinos;
create trigger destinos_bloqueia_exclusao_trg
before delete on public.destinos
for each row execute function public.destinos_bloqueia_exclusao_em_uso();

-- Impede excluir viagem que já possui leads cadastrados
create or replace function public.viagens_bloqueia_exclusao_com_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  select count(distinct lv.lead_id) into v_qtd
    from public.crm_lead_viagens lv
   where lv.viagem_id = old.id;
  if v_qtd > 0 then
    raise exception
      'Esta viagem possui % lead(s) cadastrado(s) e não pode ser excluída.', v_qtd
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists viagens_bloqueia_exclusao_com_leads_trg on public.viagens;
create trigger viagens_bloqueia_exclusao_com_leads_trg
before delete on public.viagens
for each row execute function public.viagens_bloqueia_exclusao_com_leads();

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


create table if not exists public.app_empresa (
  id boolean primary key default true,
  nome text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_empresa_singleton check (id)
);

alter table public.app_empresa
  add column if not exists email text not null default '';


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
  _whatsapp text,
  _email text default ''
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

  if coalesce(_email, '') <> '' and _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail da empresa inválido';
  end if;

  insert into public.app_empresa (id, nome, whatsapp, email)
  values (true, coalesce(_nome, ''), coalesce(_whatsapp, ''), coalesce(_email, ''))
  on conflict (id) do update
    set nome = excluded.nome,
        whatsapp = excluded.whatsapp,
        email = excluded.email;
end;
$$;

drop function if exists public.save_empresa_settings(text, text);
revoke all on function public.save_empresa_settings(text, text, text) from public;
grant execute on function public.save_empresa_settings(text, text, text) to authenticated;


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

-- ============================================================
-- 031 - Landing page: inclui UF do destino no retorno da função
-- ============================================================
create or replace function public.landing_viagem(_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_titulo        text;
  v_subtitulo     text;
  v_descricao     text;
  v_destino       text;
  v_uf            text;
  v_data_partida  date;
  v_hora_partida  time;
  v_valor         numeric;
  v_vagas         integer;
  v_itens_inclusos text[];
  v_imagens       jsonb;
  v_situacao      public.viagem_situacao;
  v_modelo        text;
  v_paleta        text;
  v_landing_slug  text;
begin
  select
    v.id,
    v.titulo,
    v.subtitulo,
    v.descricao,
    v.destino,
    d.uf,
    v.data_partida,
    v.hora_partida,
    v.valor,
    v.vagas,
    v.itens_inclusos,
    v.imagens,
    v.situacao,
    v.landing_modelo,
    v.landing_paleta,
    v.landing_slug
  into
    v_id, v_titulo, v_subtitulo, v_descricao, v_destino, v_uf,
    v_data_partida, v_hora_partida, v_valor, v_vagas, v_itens_inclusos,
    v_imagens, v_situacao, v_modelo, v_paleta, v_landing_slug
  from public.viagens v
  left join public.destinos d on d.nome = v.destino
  where v.landing_slug = _slug and v.landing_ativa = true
  limit 1;

  if v_id is null then
    return null;
  end if;

  return json_build_object(
    'id',            v_id,
    'titulo',        v_titulo,
    'subtitulo',     v_subtitulo,
    'descricao',     v_descricao,
    'destino',       v_destino,
    'uf',            v_uf,
    'data_partida',  v_data_partida,
    'hora_partida',  v_hora_partida,
    'valor',         v_valor,
    'vagas',         v_vagas,
    'itens_inclusos',v_itens_inclusos,
    'imagens',       v_imagens,
    'situacao',      v_situacao,
    'modelo',        v_modelo,
    'paleta',        v_paleta,
    'slug',          v_landing_slug
  );
end;
$$;

grant execute on function public.landing_viagem(text) to anon, authenticated;




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

-- =========================================================
-- EXPIRAÇÃO REAL DA SESSÃO (30 dias ou 6 horas)
-- =========================================================
create table if not exists public.user_session_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid,
  remember boolean not null default false,
  expira_em timestamptz not null,
  registrado_em timestamptz not null default now()
);

grant select, insert, update on public.user_session_meta to authenticated;
grant all on public.user_session_meta to service_role;

alter table public.user_session_meta enable row level security;

drop policy if exists "usuario le a propria sessao" on public.user_session_meta;
create policy "usuario le a propria sessao"
on public.user_session_meta for select to authenticated
using (user_id = auth.uid() or public.is_admin() or public.can('usuarios', 'view'));

drop policy if exists "usuario grava a propria sessao" on public.user_session_meta;
create policy "usuario grava a propria sessao"
on public.user_session_meta for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_user_session_meta_session_id
  on public.user_session_meta (session_id);

create or replace function public.registrar_expiracao_sessao(p_remember boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_exp timestamptz;
begin
  if v_uid is null then
    raise exception 'Sessão não autenticada' using errcode = '42501';
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  if v_session_id is null then
    select s.id into v_session_id
    from auth.sessions s
    where s.user_id = v_uid
    order by coalesce(s.refreshed_at, s.created_at) desc
    limit 1;
  end if;

  if v_session_id is null then
    raise exception 'Não foi possível identificar a sessão atual' using errcode = 'P0001';
  end if;

  v_exp := now() + case
    when coalesce(p_remember, false) then interval '30 days'
    else interval '6 hours'
  end;

  insert into public.user_session_meta
    (user_id, session_id, remember, expira_em, registrado_em)
  values
    (v_uid, v_session_id, coalesce(p_remember, false), v_exp, now())
  on conflict (user_id) do update
    set session_id = excluded.session_id,
        remember = excluded.remember,
        expira_em = excluded.expira_em,
        registrado_em = excluded.registrado_em;

  return v_exp;
end;
$$;

revoke all on function public.registrar_expiracao_sessao(boolean) from public, anon;
grant execute on function public.registrar_expiracao_sessao(boolean) to authenticated;

-- Substitui a versão anterior para devolver a expiração da sessão exata.
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not (public.is_admin() or public.can('usuarios', 'view')) then
    raise exception 'Sem permissão para listar usuários' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(u order by u.email), '[]'::jsonb) into v_result
  from (
    select
      p.id, p.email, p.nome, p.ativo, p.created_at, au.last_sign_in_at,
      coalesce(public.has_role(p.id, 'admin'), false) as is_admin,
      s.created_at as sessao_iniciada_em,
      s.refreshed_at as sessao_atualizada_em,
      case
        when s.id is null then null
        when m.session_id = s.id then m.expira_em
        else coalesce(s.not_after, coalesce(s.refreshed_at, s.created_at) + interval '30 days')
      end as sessao_expira_em,
      case
        when s.id is null then null
        when m.session_id = s.id then coalesce(m.remember, false)
        else null
      end as sessao_remember,
      host(s.ip) as sessao_ip,
      s.user_agent as sessao_user_agent,
      (s.id is not null) as online,
      coalesce((
        select jsonb_object_agg(
          up.modulo,
          jsonb_build_object('view', up.can_view, 'edit', up.can_edit, 'delete', up.can_delete)
        )
        from public.user_permissions up where up.user_id = p.id
      ), '{}'::jsonb) as permissoes
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join lateral (
      select se.id, se.created_at, se.refreshed_at, se.not_after, se.ip, se.user_agent
      from auth.sessions se
      where se.user_id = p.id
        and (se.not_after is null or se.not_after > now())
      order by coalesce(se.refreshed_at, se.created_at) desc
      limit 1
    ) s on true
    left join public.user_session_meta m
      on m.user_id = p.id and m.session_id = s.id
  ) u;

  return v_result;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

commit;
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

-- Realtime para as visitas
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_visitas'
  ) then
    execute 'alter publication supabase_realtime add table public.site_visitas';
  end if;
end;
$$;

alter table public.site_visitas replica identity full;

commit;

-- =====================================================================
-- 042 - Dashboard: detalhamento das visitas (últimas 10 com detalhes)
-- =====================================================================
begin;

-- 1) Novas colunas de detalhe da visita ------------------------------
alter table public.site_visitas
  add column if not exists ip text,
  add column if not exists cidade text,
  add column if not exists regiao text,
  add column if not exists pais text,
  add column if not exists provedor text,
  add column if not exists user_agent text,
  add column if not exists dispositivo text,
  add column if not exists navegador text,
  add column if not exists sistema text,
  add column if not exists idioma text,
  add column if not exists resolucao text,
  add column if not exists fuso text,
  add column if not exists query text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists fbclid text,
  add column if not exists gclid text,
  add column if not exists virou_lead boolean not null default false,
  add column if not exists lead_id uuid references public.crm_leads(id) on delete set null,
  add column if not exists detalhes jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 2) Registro de visita com detalhes ---------------------------------
drop function if exists public.registrar_visita(text, text, text);

create or replace function public.registrar_visita(
  _visitor text,
  _path text default '/',
  _referrer text default null,
  _dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recente uuid;
  v_headers jsonb;
  v_ip text;
  v_dados jsonb := coalesce(_dados, '{}'::jsonb);
begin
  if _visitor is null or length(_visitor) < 4 then
    return;
  end if;

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := nullif(split_part(coalesce(v_dados->>'ip', v_headers->>'x-forwarded-for', ''), ',', 1), '');

  select id into v_recente
  from public.site_visitas v
  where v.visitor_id = _visitor
    and v.path = coalesce(_path, '/')
    and v.created_at > now() - interval '1 minute'
  order by v.created_at desc
  limit 1;

  if v_recente is not null then
    -- Heartbeat: mantém a visita "viva" sem duplicar registros.
    update public.site_visitas
       set created_at = now(),
           updated_at = now(),
           ip = coalesce(ip, v_ip),
           cidade = coalesce(cidade, v_dados->>'cidade'),
           regiao = coalesce(regiao, v_dados->>'regiao'),
           pais = coalesce(pais, v_dados->>'pais'),
           provedor = coalesce(provedor, v_dados->>'provedor'),
           detalhes = detalhes || v_dados
     where id = v_recente;
    return;
  end if;

  insert into public.site_visitas (
    visitor_id, path, referrer, ip, cidade, regiao, pais, provedor,
    user_agent, dispositivo, navegador, sistema, idioma, resolucao, fuso, query,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, detalhes
  ) values (
    _visitor,
    coalesce(_path, '/'),
    _referrer,
    v_ip,
    v_dados->>'cidade',
    v_dados->>'regiao',
    v_dados->>'pais',
    v_dados->>'provedor',
    coalesce(v_dados->>'user_agent', v_headers->>'user-agent'),
    v_dados->>'dispositivo',
    v_dados->>'navegador',
    v_dados->>'sistema',
    v_dados->>'idioma',
    v_dados->>'resolucao',
    v_dados->>'fuso',
    v_dados->>'query',
    v_dados->>'utm_source',
    v_dados->>'utm_medium',
    v_dados->>'utm_campaign',
    v_dados->>'utm_term',
    v_dados->>'utm_content',
    v_dados->>'fbclid',
    v_dados->>'gclid',
    v_dados
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, jsonb) from public;
grant execute on function public.registrar_visita(text, text, text, jsonb) to anon, authenticated;

-- 3) Marca a visita como convertida em lead --------------------------
create or replace function public.marcar_visita_lead(
  _visitor text,
  _whatsapp text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_lead uuid;
begin
  if _visitor is null then return; end if;

  select id into v_id
  from public.site_visitas
  where visitor_id = _visitor
  order by created_at desc
  limit 1;

  if v_id is null then return; end if;

  if _whatsapp is not null then
    select l.id into v_lead
    from public.crm_leads l
    where regexp_replace(l.whatsapp, '\D', '', 'g') = regexp_replace(_whatsapp, '\D', '', 'g')
    order by l.created_at desc
    limit 1;
  end if;

  update public.site_visitas
     set virou_lead = true,
         lead_id = coalesce(v_lead, lead_id),
         updated_at = now()
   where id = v_id;
end;
$$;

revoke all on function public.marcar_visita_lead(text, text) from public;
grant execute on function public.marcar_visita_lead(text, text) to anon, authenticated;

-- 4) Últimas visitas para o Dashboard --------------------------------
create or replace function public.dashboard_ultimas_visitas(_limite int default 10)
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

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v
  from (
    select
      s.id, s.visitor_id, s.created_at, s.updated_at, s.path, s.referrer,
      s.ip, s.cidade, s.regiao, s.pais, s.provedor,
      s.user_agent, s.dispositivo, s.navegador, s.sistema, s.idioma,
      s.resolucao, s.fuso, s.query,
      s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term, s.utm_content,
      s.fbclid, s.gclid, s.virou_lead, s.lead_id, s.detalhes,
      l.nome as lead_nome, l.whatsapp as lead_whatsapp, l.origem as lead_origem,
      st.nome as lead_etapa
    from public.site_visitas s
    left join public.crm_leads l on l.id = s.lead_id
    left join public.crm_stages st on st.id = l.stage_id
    order by s.created_at desc
    limit greatest(1, least(coalesce(_limite, 10), 100))
  ) x;

  return v;
end;
$$;

revoke all on function public.dashboard_ultimas_visitas(int) from public, anon;
grant execute on function public.dashboard_ultimas_visitas(int) to authenticated;

commit;

-- =====================================================================
-- 043 - Visitas: garante o registro completo (cidade, IP, geo e demais)
-- =====================================================================
begin;

create or replace function public.registrar_visita(
  _visitor text,
  _path text default '/',
  _referrer text default null,
  _dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recente uuid;
  v_headers jsonb;
  v_ip text;
  v_dados jsonb := coalesce(_dados, '{}'::jsonb);
begin
  if _visitor is null or length(_visitor) < 4 then
    return;
  end if;

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  -- IP: prioriza o informado pelo cliente (geolocalização) e cai para os headers.
  v_ip := nullif(
    btrim(split_part(coalesce(
      nullif(v_dados->>'ip', ''),
      nullif(v_headers->>'cf-connecting-ip', ''),
      nullif(v_headers->>'x-real-ip', ''),
      nullif(v_headers->>'x-forwarded-for', ''),
      ''
    ), ',', 1)),
    ''
  );

  select id into v_recente
  from public.site_visitas v
  where v.visitor_id = _visitor
    and v.path = coalesce(_path, '/')
    and v.created_at > now() - interval '1 minute'
  order by v.created_at desc
  limit 1;

  if v_recente is not null then
    -- Heartbeat: mantém a visita viva e completa TODOS os campos vazios.
    update public.site_visitas s
       set created_at  = now(),
           updated_at  = now(),
           referrer    = coalesce(nullif(s.referrer, ''), nullif(_referrer, '')),
           ip          = coalesce(nullif(s.ip, ''), v_ip),
           cidade      = coalesce(nullif(s.cidade, ''), nullif(v_dados->>'cidade', '')),
           regiao      = coalesce(nullif(s.regiao, ''), nullif(v_dados->>'regiao', '')),
           pais        = coalesce(nullif(s.pais, ''), nullif(v_dados->>'pais', '')),
           provedor    = coalesce(nullif(s.provedor, ''), nullif(v_dados->>'provedor', '')),
           user_agent  = coalesce(nullif(s.user_agent, ''), nullif(v_dados->>'user_agent', ''), v_headers->>'user-agent'),
           dispositivo = coalesce(nullif(s.dispositivo, ''), nullif(v_dados->>'dispositivo', '')),
           navegador   = coalesce(nullif(s.navegador, ''), nullif(v_dados->>'navegador', '')),
           sistema     = coalesce(nullif(s.sistema, ''), nullif(v_dados->>'sistema', '')),
           idioma      = coalesce(nullif(s.idioma, ''), nullif(v_dados->>'idioma', '')),
           resolucao   = coalesce(nullif(s.resolucao, ''), nullif(v_dados->>'resolucao', '')),
           fuso        = coalesce(nullif(s.fuso, ''), nullif(v_dados->>'fuso', '')),
           query       = coalesce(nullif(s.query, ''), nullif(v_dados->>'query', '')),
           utm_source  = coalesce(nullif(s.utm_source, ''), nullif(v_dados->>'utm_source', '')),
           utm_medium  = coalesce(nullif(s.utm_medium, ''), nullif(v_dados->>'utm_medium', '')),
           utm_campaign= coalesce(nullif(s.utm_campaign, ''), nullif(v_dados->>'utm_campaign', '')),
           utm_term    = coalesce(nullif(s.utm_term, ''), nullif(v_dados->>'utm_term', '')),
           utm_content = coalesce(nullif(s.utm_content, ''), nullif(v_dados->>'utm_content', '')),
           fbclid      = coalesce(nullif(s.fbclid, ''), nullif(v_dados->>'fbclid', '')),
           gclid       = coalesce(nullif(s.gclid, ''), nullif(v_dados->>'gclid', '')),
           detalhes    = s.detalhes || v_dados
                          || jsonb_strip_nulls(jsonb_build_object('ip', v_ip))
     where s.id = v_recente;
    return;
  end if;

  insert into public.site_visitas (
    visitor_id, path, referrer, ip, cidade, regiao, pais, provedor,
    user_agent, dispositivo, navegador, sistema, idioma, resolucao, fuso, query,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, detalhes
  ) values (
    _visitor,
    coalesce(_path, '/'),
    nullif(_referrer, ''),
    v_ip,
    nullif(v_dados->>'cidade', ''),
    nullif(v_dados->>'regiao', ''),
    nullif(v_dados->>'pais', ''),
    nullif(v_dados->>'provedor', ''),
    coalesce(nullif(v_dados->>'user_agent', ''), v_headers->>'user-agent'),
    nullif(v_dados->>'dispositivo', ''),
    nullif(v_dados->>'navegador', ''),
    nullif(v_dados->>'sistema', ''),
    nullif(v_dados->>'idioma', ''),
    nullif(v_dados->>'resolucao', ''),
    nullif(v_dados->>'fuso', ''),
    nullif(v_dados->>'query', ''),
    nullif(v_dados->>'utm_source', ''),
    nullif(v_dados->>'utm_medium', ''),
    nullif(v_dados->>'utm_campaign', ''),
    nullif(v_dados->>'utm_term', ''),
    nullif(v_dados->>'utm_content', ''),
    nullif(v_dados->>'fbclid', ''),
    nullif(v_dados->>'gclid', ''),
    v_dados || jsonb_strip_nulls(jsonb_build_object('ip', v_ip))
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, jsonb) from public;
grant execute on function public.registrar_visita(text, text, text, jsonb) to anon, authenticated;

-- 046 - Só permite excluir viagens que estejam com situação "rascunho"

create or replace function public.viagens_bloqueia_exclusao_nao_rascunho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.situacao is distinct from 'rascunho'::viagem_situacao then
    raise exception 'Somente viagens em Rascunho podem ser excluídas (situação atual: %).', coalesce(old.situacao::text, 'indefinida')
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists viagens_bloqueia_exclusao_nao_rascunho_trg on public.viagens;

create trigger viagens_bloqueia_exclusao_nao_rascunho_trg
before delete on public.viagens
for each row
execute function public.viagens_bloqueia_exclusao_nao_rascunho();


-- 047 - Landing page publica somente para viagens com situacao "ativa"
begin;
-- 047 - Landing page pública somente para viagens com situação "ativa"


-- landing_viagem: só retorna a viagem quando a landing está ativa E a situação é "ativa"
create or replace function public.landing_viagem(_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_titulo        text;
  v_subtitulo     text;
  v_descricao     text;
  v_destino       text;
  v_uf            text;
  v_data_partida  date;
  v_hora_partida  time;
  v_valor         numeric;
  v_vagas         integer;
  v_itens_inclusos text[];
  v_imagens       jsonb;
  v_situacao      public.viagem_situacao;
  v_modelo        text;
  v_paleta        text;
  v_landing_slug  text;
begin
  select
    v.id, v.titulo, v.subtitulo, v.descricao, v.destino, d.uf,
    v.data_partida, v.hora_partida, v.valor, v.vagas, v.itens_inclusos,
    v.imagens, v.situacao, v.landing_modelo, v.landing_paleta, v.landing_slug
  into
    v_id, v_titulo, v_subtitulo, v_descricao, v_destino, v_uf,
    v_data_partida, v_hora_partida, v_valor, v_vagas, v_itens_inclusos,
    v_imagens, v_situacao, v_modelo, v_paleta, v_landing_slug
  from public.viagens v
  left join public.destinos d on d.nome = v.destino
  where v.landing_slug = _slug
    and v.landing_ativa = true
    and v.situacao = 'ativa'
  limit 1;

  if v_id is null then
    return null;
  end if;

  return json_build_object(
    'id',            v_id,
    'titulo',        v_titulo,
    'subtitulo',     v_subtitulo,
    'descricao',     v_descricao,
    'destino',       v_destino,
    'uf',            v_uf,
    'data_partida',  v_data_partida,
    'hora_partida',  v_hora_partida,
    'valor',         v_valor,
    'vagas',         v_vagas,
    'itens_inclusos',v_itens_inclusos,
    'imagens',       v_imagens,
    'situacao',      v_situacao,
    'modelo',        v_modelo,
    'paleta',        v_paleta,
    'slug',          v_landing_slug
  );
end;
$$;

grant execute on function public.landing_viagem(text) to anon, authenticated;

-- landing_lead: recusa envios de viagens que não estejam ativas
create or replace function public.landing_lead(
  _slug     text,
  _nome     text,
  _whatsapp text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_viagem  public.viagens;
  v_stage   uuid;
  v_lead    uuid;
  v_digits  text;
begin
  v_digits := regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g');

  if coalesce(btrim(_nome), '') = '' or length(v_digits) < 10 then
    return json_build_object('ok', false, 'message', 'Informe seu nome e um WhatsApp válido com DDD.');
  end if;

  select * into v_viagem
  from public.viagens
  where landing_slug = _slug
    and landing_ativa = true
    and situacao = 'ativa'
  limit 1;

  if not found then
    return json_build_object('ok', false, 'message', 'Esta viagem não está mais disponível.');
  end if;

  select id into v_stage
  from public.crm_stages
  where ativo = true
  order by posicao asc, created_at asc
  limit 1;

  if v_stage is null then
    insert into public.crm_stages (nome, posicao, ativo)
    values ('Novo Lead', 0, true)
    returning id into v_stage;
  end if;

  insert into public.crm_leads (nome, whatsapp, origem, stage_id, posicao)
  values (
    btrim(_nome),
    case
      when length(v_digits) = 11 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,5) || '-' || substr(v_digits,8,4)
      when length(v_digits) = 10 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,4) || '-' || substr(v_digits,7,4)
      else v_digits
    end,
    'Landing Page',
    v_stage,
    coalesce((select min(posicao) - 1 from public.crm_leads where stage_id = v_stage), 0)
  )
  returning id into v_lead;

  begin
    insert into public.crm_lead_viagens (lead_id, viagem_id)
    values (v_lead, v_viagem.id)
    on conflict do nothing;
  exception when others then
    null; -- vinculo com a viagem e opcional; nao deve impedir o lead
  end;

  return json_build_object('ok', true, 'lead_id', v_lead);
exception when others then
  return json_build_object('ok', false,
    'message', 'Erro ao salvar o lead: ' || sqlerrm,
    'code', sqlstate);
end;
$$;

grant execute on function public.landing_lead(text, text, text) to anon, authenticated;

commit;

commit;
