-- ELO Transporte e Turismo — RESET TOTAL DO BANCO
-- ⚠️ ATENÇÃO: este script APAGA todos os objetos da aplicação e TODOS os usuários.
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA. Não há como desfazer.

begin;

-- 1) Triggers criados pela aplicação no schema auth
drop trigger if exists on_auth_user_created on auth.users;

-- 2) Tabelas da aplicação (schema public)
drop table if exists public.user_permissions cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.profiles cascade;

-- 3) Funções da aplicação
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_active() cascade;
drop function if exists public.can(text, text) cascade;
drop function if exists public.login_is_blocked(text) cascade;
drop function if exists public.admin_list_users() cascade;
drop function if exists public.admin_save_user(uuid, text, text, boolean, text, jsonb) cascade;
drop function if exists public.admin_create_user(text, text, text, text) cascade;
drop function if exists public.admin_delete_user(uuid) cascade;
drop function if exists public.admin_sync_profiles() cascade;

-- 3.1) Varredura: apaga QUALQUER função restante no schema public
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

-- 4) Tipos
drop type if exists public.app_role cascade;

-- 4.1) Varredura: apaga QUALQUER tipo/enum restante criado no schema public
do $$
declare r record;
begin
  for r in
    select t.oid::regtype as tp
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype in ('e','c','d')
      and not exists (select 1 from pg_class c where c.oid = t.typrelid and c.relkind <> 'c')
  loop
    execute format('drop type if exists %s cascade', r.tp);
  end loop;
end $$;

-- 5) (OPCIONAL) Apagar TODOS os usuários de autenticação.
--    Comente esta linha se quiser manter suas contas de login.
delete from auth.users;

commit;

-- 6) Recarrega o cache do PostgREST
notify pgrst, 'reload schema';
