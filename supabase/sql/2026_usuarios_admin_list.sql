-- ELO — Listagem de usuários por permissão de módulo (não só admin)
-- Quem tem permissão de VISUALIZAR o módulo "usuarios" pode listar.
-- Escrita (criar/salvar/excluir) continua restrita a admin nas outras funções.

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  nome text,
  ativo boolean,
  role public.app_role,
  permissions jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can('usuarios', 'view') then
    raise exception 'Sem permissão para visualizar usuários.'
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
    ) as role,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'user_id', up.user_id,
                'modulo', up.modulo,
                'can_view', up.can_view,
                'can_edit', up.can_edit,
                'can_delete', up.can_delete))
         from public.user_permissions up
        where up.user_id = u.id),
      '[]'::jsonb
    ) as permissions
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.email;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

notify pgrst, 'reload schema';
