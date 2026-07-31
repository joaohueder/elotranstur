-- =========================================================
-- 034 - Corrige: usuário não-admin era bloqueado ao salvar a
--       própria conta (mensagem 'Você não pode remover o
--       próprio acesso de administrador').
--       Agora o bloqueio só ocorre se a conta REALMENTE for admin.
-- =========================================================

-- ---------------------------------------------------------
-- Salvar usuário
-- ---------------------------------------------------------
create or replace function public.admin_save_user(
  _user_id uuid,
  _nome text default null,
  _is_admin boolean default null,
  _ativo boolean default null,
  _permissoes jsonb default null,
  _nova_senha text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_sou_admin boolean := public.is_admin();
  v_alvo_admin boolean;
begin
  if not (v_sou_admin or public.can('usuarios', 'edit')) then
    raise exception 'Você não tem permissão para alterar usuários' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;

  v_alvo_admin := public.has_role(_user_id, 'admin');

  if not v_sou_admin then
    if v_alvo_admin then
      raise exception 'Somente administradores podem alterar contas de administrador' using errcode = '42501';
    end if;
    if _is_admin is not null and _is_admin then
      raise exception 'Somente administradores podem conceder acesso de administrador' using errcode = '42501';
    end if;
  end if;

  if _nome is not null then
    update public.profiles set nome = _nome, updated_at = now() where id = _user_id;
  end if;

  if _ativo is not null then
    if _user_id = auth.uid() and _ativo = false then
      raise exception 'Você não pode desativar a própria conta' using errcode = '42501';
    end if;

    update public.profiles set ativo = _ativo, updated_at = now() where id = _user_id;

    if _ativo then
      update auth.users set banned_until = null, updated_at = now() where id = _user_id;
    else
      update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = _user_id;
      delete from auth.sessions where user_id = _user_id;
      delete from auth.refresh_tokens where user_id = _user_id::text;
    end if;
  end if;

  if _is_admin is not null then
    -- só bloqueia quando o próprio usuário É admin e está tentando se rebaixar
    if _user_id = auth.uid() and _is_admin = false and v_alvo_admin then
      raise exception 'Você não pode remover o próprio acesso de administrador' using errcode = '42501';
    end if;
    delete from public.user_roles where user_id = _user_id;
    insert into public.user_roles (user_id, role)
    values (_user_id, case when _is_admin then 'admin'::public.app_role else 'user'::public.app_role end)
    on conflict do nothing;
  end if;

  if _permissoes is not null then
    delete from public.user_permissions where user_id = _user_id;
    for v_item in select * from jsonb_each(_permissoes) loop
      insert into public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
      values (
        _user_id, v_item.key,
        coalesce((v_item.value->>'view')::boolean, false),
        coalesce((v_item.value->>'edit')::boolean, false),
        coalesce((v_item.value->>'delete')::boolean, false)
      );
    end loop;
  end if;

  if _nova_senha is not null and length(_nova_senha) > 0 then
    if length(_nova_senha) < 8 then
      raise exception 'A senha deve ter no mínimo 8 caracteres' using errcode = '22023';
    end if;
    update auth.users
       set encrypted_password = crypt(_nova_senha, gen_salt('bf')), updated_at = now()
     where id = _user_id;
  end if;

  return jsonb_build_object('ok', true, 'id', _user_id);
end;
$$;

revoke all on function public.admin_save_user(uuid, text, boolean, boolean, jsonb, text) from public, anon;
grant execute on function public.admin_save_user(uuid, text, boolean, boolean, jsonb, text) to authenticated;

