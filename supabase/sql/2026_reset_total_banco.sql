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

-- 4) Tipos
drop type if exists public.app_role cascade;

-- 5) (OPCIONAL) Apagar TODOS os usuários de autenticação.
--    Comente esta linha se quiser manter suas contas de login.
delete from auth.users;

commit;

-- 6) Recarrega o cache do PostgREST
notify pgrst, 'reload schema';
