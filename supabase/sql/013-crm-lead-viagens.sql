-- =====================================================================
-- 013 - CRM · Viagens de interesse do lead (N para N)
-- Banco: Supabase auto-hospedado
-- Executar após 012.
-- =====================================================================

begin;

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

commit;
