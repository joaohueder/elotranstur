-- ELO Transporte e Turismo — CRUD de usuários pelo módulo (admin)
-- Supabase AUTO-HOSPEDADO: execute este SQL no SQL Editor da sua instância.
-- Depende de 2026_usuarios_papeis_permissoes.sql (profiles, user_roles, is_admin).

-- =========================================================
-- Exclusão definitiva de um usuário (auth.users + cascata)
-- Somente administradores; nunca a própria conta.
-- =========================================================
create or replace function public.admin_delete_user(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir usuários.'
      using errcode = '42501';
  end if;

  if _user_id = auth.uid() then
    raise exception 'Você não pode excluir a sua própria conta.'
      using errcode = '42501';
  end if;

  delete from auth.users where id = _user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- =========================================================
-- Ativar/desativar e renomear já são cobertos pelas policies
-- de UPDATE em public.profiles (admin ou próprio usuário).
-- =========================================================

notify pgrst, 'reload schema';
