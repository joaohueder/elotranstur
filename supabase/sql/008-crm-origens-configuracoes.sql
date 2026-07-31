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
