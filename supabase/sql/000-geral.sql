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
begin
  if exists (select 1 from public.viagens v where lower(v.destino) = lower(old.nome)) then
    raise exception 'O destino "%" está sendo usado em viagens e não pode ser excluído.', old.nome
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists destinos_bloqueia_exclusao_trg on public.destinos;
create trigger destinos_bloqueia_exclusao_trg
before delete on public.destinos
for each row execute function public.destinos_bloqueia_exclusao_em_uso();

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
