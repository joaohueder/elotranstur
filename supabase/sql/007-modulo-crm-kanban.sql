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
