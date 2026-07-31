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
      coalesce((
        select jsonb_object_agg(
          up.modulo,
          jsonb_build_object('view', up.can_view, 'edit', up.can_edit, 'delete', up.can_delete)
        )
        from public.user_permissions up where up.user_id = p.id
      ), '{}'::jsonb) as permissoes
    from public.profiles p
    left join auth.users au on au.id = p.id
  ) u;

  return v_result;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

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
  if not public.is_admin() then
    raise exception 'Somente administradores podem excluir usuários' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta' using errcode = '42501';
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
