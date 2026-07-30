-- ELO Transporte e Turismo — Sincronização de perfis (admin)
-- Supabase AUTO-HOSPEDADO: execute este SQL no SQL Editor da sua instância.
-- Depende de 2026_usuarios_papeis_permissoes.sql (profiles, user_roles, is_admin).

-- =========================================================
-- Garante que TODO usuário de auth.users tenha perfil e papel.
-- Usado pelo módulo Usuários antes de listar, para que contas
-- recém-criadas (ou criadas fora do sistema) sempre apareçam.
-- =========================================================
create or replace function public.admin_sync_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _inseridos integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem sincronizar usuários.'
      using errcode = '42501';
  end if;

  with novos as (
    insert into public.profiles (id, email, nome)
    select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', u.email)
    from auth.users u
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into _inseridos from novos;

  -- mantém e-mail do perfil alinhado com auth.users
  update public.profiles p
     set email = u.email
    from auth.users u
   where u.id = p.id
     and coalesce(p.email, '') is distinct from coalesce(u.email, '');

  -- todo usuário precisa de ao menos um papel
  insert into public.user_roles (user_id, role)
  select u.id, 'usuario'
  from auth.users u
  where not exists (
    select 1 from public.user_roles r where r.user_id = u.id
  )
  on conflict (user_id, role) do nothing;

  return _inseridos;
end;
$$;

revoke all on function public.admin_sync_profiles() from public, anon;
grant execute on function public.admin_sync_profiles() to authenticated;

notify pgrst, 'reload schema';
