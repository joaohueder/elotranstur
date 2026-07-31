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
