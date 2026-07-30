-- ELO — Salvamento de usuário (admin), à prova de perfil inexistente e de RLS
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA.
--
-- Grava em uma única chamada: profiles (upsert), user_roles e user_permissions.

create or replace function public.admin_save_user(
  _user_id uuid,
  _nome text,
  _ativo boolean,
  _role public.app_role,
  _permissions jsonb default '[]'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p jsonb;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar usuários.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = _user_id) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  -- Perfil (cria se não existir)
  insert into public.profiles (id, nome, ativo)
  values (_user_id, nullif(btrim(coalesce(_nome, '')), ''), coalesce(_ativo, true))
  on conflict (id) do update
    set nome = excluded.nome,
        ativo = excluded.ativo;

  -- Papel
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);

  -- Permissões (ignoradas para admin, que já acessa tudo)
  if _role = 'admin' then
    delete from public.user_permissions where user_id = _user_id;
  else
    for p in select * from jsonb_array_elements(coalesce(_permissions, '[]'::jsonb))
    loop
      insert into public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
      values (
        _user_id,
        p->>'modulo',
        coalesce((p->>'can_view')::boolean, false),
        coalesce((p->>'can_edit')::boolean, false),
        coalesce((p->>'can_delete')::boolean, false)
      )
      on conflict (user_id, modulo) do update
        set can_view = excluded.can_view,
            can_edit = excluded.can_edit,
            can_delete = excluded.can_delete;
    end loop;
  end if;
end;
$$;

revoke all on function public.admin_save_user(uuid, text, boolean, public.app_role, jsonb) from public, anon;
grant execute on function public.admin_save_user(uuid, text, boolean, public.app_role, jsonb) to authenticated;

notify pgrst, 'reload schema';
