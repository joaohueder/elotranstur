-- ELO Transporte e Turismo — Módulo de Usuários, Papéis e Permissões
-- Supabase AUTO-HOSPEDADO: execute este SQL no SQL Editor da sua instância.

-- =========================================================
-- 1) Enum de papéis
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'usuario');
  end if;
end$$;

-- =========================================================
-- 2) Perfis (espelho seguro de auth.users)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
alter table public.profiles enable row level security;

-- =========================================================
-- 3) Papéis do usuário (NUNCA no profiles — evita escalonamento)
-- =========================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select, insert, update, delete on public.user_roles to authenticated;
alter table public.user_roles enable row level security;

-- =========================================================
-- 4) Permissões por módulo (apenas para o papel "usuario")
-- =========================================================
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, modulo)
);

grant select, insert, update, delete on public.user_permissions to authenticated;
alter table public.user_permissions enable row level security;

-- =========================================================
-- 5) Funções de verificação (SECURITY DEFINER, evita recursão em RLS)
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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

-- Admin sempre true; usuário depende de user_permissions.
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
        when 'view' then p.can_view
        when 'edit' then p.can_edit
        when 'delete' then p.can_delete
        else false
      end
      from public.user_permissions p
      where p.user_id = auth.uid() and p.modulo = _modulo
    ), false)
  end;
$$;

-- =========================================================
-- 6) Políticas RLS
-- =========================================================
-- profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- user_roles: leitura do próprio papel; escrita só admin
drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert" on public.user_roles
  for insert to authenticated with check (public.is_admin());

drop policy if exists "user_roles_admin_update" on public.user_roles;
create policy "user_roles_admin_update" on public.user_roles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles
  for delete to authenticated using (public.is_admin());

-- user_permissions: leitura das próprias; escrita só admin
drop policy if exists "user_permissions_select_own_or_admin" on public.user_permissions;
create policy "user_permissions_select_own_or_admin" on public.user_permissions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_permissions_admin_insert" on public.user_permissions;
create policy "user_permissions_admin_insert" on public.user_permissions
  for insert to authenticated with check (public.is_admin());

drop policy if exists "user_permissions_admin_update" on public.user_permissions;
create policy "user_permissions_admin_update" on public.user_permissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user_permissions_admin_delete" on public.user_permissions;
create policy "user_permissions_admin_delete" on public.user_permissions
  for delete to authenticated using (public.is_admin());

-- =========================================================
-- 7) Triggers: updated_at + criação automática de perfil/papel
-- =========================================================
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

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_permissions_updated_at on public.user_permissions;
create trigger trg_user_permissions_updated_at before update on public.user_permissions
  for each row execute function public.set_updated_at();

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

  insert into public.user_roles (user_id, role)
  values (new.id, 'usuario')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 8) Backfill dos usuários já existentes
-- =========================================================
insert into public.profiles (id, email, nome)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', u.email)
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'usuario' from auth.users u
on conflict (user_id, role) do nothing;

-- =========================================================
-- 9) DEFINA O PRIMEIRO ADMIN (troque o e-mail abaixo)
-- =========================================================
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'seu-email@empresa.com.br'
-- on conflict (user_id, role) do nothing;
