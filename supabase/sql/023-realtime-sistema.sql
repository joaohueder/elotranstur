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
