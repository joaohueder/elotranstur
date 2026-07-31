-- =====================================================================
-- Recriação do schema mínimo + CRM com notas
-- Banco: Supabase auto-hospedado
-- =====================================================================

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
-- 2) Tabelas base
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

-- =========================================================
-- 3) Funções de acesso (antes das políticas RLS)
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
-- 4) Políticas RLS das tabelas base
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

drop policy if exists "user_permissions_select_self_or_admin" on public.user_permissions;
create policy "user_permissions_select_self_or_admin"
  on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- =========================================================
-- 5) Trigger de perfil para novos usuários
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
-- 6) Usuário admin inicial
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

-- =========================================================
-- 7) Trigger de updated_at
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

-- =========================================================
-- 8) CRM · Etapas
-- =========================================================
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

drop trigger if exists crm_stages_set_updated_at on public.crm_stages;
create trigger crm_stages_set_updated_at
before update on public.crm_stages
for each row execute function public.set_updated_at();

insert into public.crm_stages (nome, cor, posicao)
select * from (values
  ('Novo lead',   '#64748b', 0),
  ('Em contato',  '#2563eb', 1),
  ('Proposta',    '#d97706', 2),
  ('Fechado',     '#16a34a', 3),
  ('Perdido',     '#dc2626', 4)
) as v(nome, cor, posicao)
where not exists (select 1 from public.crm_stages);

-- =========================================================
-- 9) CRM · Origens
-- =========================================================
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

-- =========================================================
-- 10) Viagens (mínimo necessário para relacionamentos)
-- =========================================================
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
  hora_partida   time,
  titulo         text,
  subtitulo      text,
  descricao      text,
  itens_inclusos text[] not null default '{}',
  situacao       public.viagem_situacao not null default 'rascunho',
  valor          numeric(12,2) not null default 0,
  vagas          integer not null default 0,
  imagens        jsonb not null default '[]'::jsonb,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.viagens drop constraint if exists viagens_vagas_nao_negativa;
alter table public.viagens add constraint viagens_vagas_nao_negativa check (vagas >= 0);

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

-- =========================================================
-- 11) CRM · Leads
-- =========================================================
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

drop trigger if exists crm_leads_set_updated_at on public.crm_leads;
create trigger crm_leads_set_updated_at
before update on public.crm_leads
for each row execute function public.set_updated_at();

-- =========================================================
-- 12) CRM · Viagens de interesse do lead
-- =========================================================
create table if not exists public.crm_lead_viagens (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.crm_leads(id) on delete cascade,
  viagem_id   uuid not null references public.viagens(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (lead_id, viagem_id)
);

create index if not exists crm_lead_viagens_lead_idx on public.crm_lead_viagens (lead_id);
create index if not exists crm_lead_viagens_viagem_idx on public.crm_lead_viagens (viagem_id);

grant select, insert, update, delete on public.crm_lead_viagens to authenticated;
grant all on public.crm_lead_viagens to service_role;

alter table public.crm_lead_viagens enable row level security;

drop policy if exists "crm_lead_viagens_select" on public.crm_lead_viagens;
create policy "crm_lead_viagens_select" on public.crm_lead_viagens
for select to authenticated
using (public.is_admin() or public.can('crm', 'view'));

drop policy if exists "crm_lead_viagens_insert" on public.crm_lead_viagens;
create policy "crm_lead_viagens_insert" on public.crm_lead_viagens
for insert to authenticated
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_lead_viagens_update" on public.crm_lead_viagens;
create policy "crm_lead_viagens_update" on public.crm_lead_viagens
for update to authenticated
using (public.is_admin() or public.can('crm', 'edit'))
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_lead_viagens_delete" on public.crm_lead_viagens;
create policy "crm_lead_viagens_delete" on public.crm_lead_viagens
for delete to authenticated
using (public.is_admin() or public.can('crm', 'delete'));

-- =========================================================
-- 13) CRM · Notas do lead
-- =========================================================
create table if not exists public.crm_lead_notas (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.crm_leads(id) on delete cascade,
  data_hora   timestamptz not null default now(),
  descricao   text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists crm_lead_notas_lead_idx on public.crm_lead_notas (lead_id);
create index if not exists crm_lead_notas_data_hora_idx on public.crm_lead_notas (data_hora desc);

grant select, insert, update, delete on public.crm_lead_notas to authenticated;
grant all on public.crm_lead_notas to service_role;

alter table public.crm_lead_notas enable row level security;

drop policy if exists "crm_lead_notas_select" on public.crm_lead_notas;
create policy "crm_lead_notas_select" on public.crm_lead_notas
for select to authenticated
using (public.is_admin() or public.can('crm', 'view'));

drop policy if exists "crm_lead_notas_insert" on public.crm_lead_notas;
create policy "crm_lead_notas_insert" on public.crm_lead_notas
for insert to authenticated
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_lead_notas_update" on public.crm_lead_notas;
create policy "crm_lead_notas_update" on public.crm_lead_notas
for update to authenticated
using (public.is_admin() or public.can('crm', 'edit'))
with check (public.is_admin() or public.can('crm', 'edit'));

drop policy if exists "crm_lead_notas_delete" on public.crm_lead_notas;
create policy "crm_lead_notas_delete" on public.crm_lead_notas
for delete to authenticated
using (public.is_admin() or public.can('crm', 'delete'));

drop trigger if exists crm_lead_notas_set_updated_at on public.crm_lead_notas;
create trigger crm_lead_notas_set_updated_at
before update on public.crm_lead_notas
for each row execute function public.set_updated_at();

commit;

notify pgrst, 'reload schema';