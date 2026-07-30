-- ELO — Listagem de usuários à prova de falhas (admin)
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA.
-- Lê direto de auth.users, então nunca depende de profiles estar populado.

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  nome text,
  ativo boolean,
  role public.app_role
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem listar usuários.'
      using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.nome, u.raw_user_meta_data->>'nome', u.email)::text as nome,
    coalesce(p.ativo, true) as ativo,
    coalesce(
      (select 'admin'::public.app_role
         from public.user_roles r
        where r.user_id = u.id and r.role = 'admin' limit 1),
      'usuario'::public.app_role
    ) as role
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.email;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

notify pgrst, 'reload schema';
