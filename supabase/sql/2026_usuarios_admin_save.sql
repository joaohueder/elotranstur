-- ELO — Salvamento de usuário (admin), transacional e à prova de RLS
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA.
--
-- Corrige: ERROR 42P13 (cannot change return type of existing function)
-- removendo TODAS as assinaturas antigas antes de recriar.

begin;

-- 1) Remove todas as versões anteriores (qualquer tipo de retorno)
do $do$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_save_user'
  loop
    execute format('drop function if exists %s;', r.sig);
  end loop;
end
$do$;

-- 2) Função auxiliar: usuário ativo?
create or replace function public.is_active(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.ativo from public.profiles p where p.id = _user_id),
    true
  )
  and not exists (
    select 1 from auth.users u
    where u.id = _user_id
      and u.banned_until is not null
      and u.banned_until > now()
  );
$$;

revoke all on function public.is_active(uuid) from public, anon;
grant execute on function public.is_active(uuid) to authenticated;

-- 3) Salvamento administrativo (retorna o estado final gravado)
create function public.admin_save_user(
  _user_id uuid,
  _nome text,
  _ativo boolean,
  _role public.app_role,
  _permissions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p jsonb;
  allowed_modules text[] := array['viagens','leads','crm','landing_pages','configuracoes','usuarios'];
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar usuários.' using errcode = '42501';
  end if;

  if _user_id is null then
    raise exception 'user_id obrigatório.' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = _user_id) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  -- Perfil
  insert into public.profiles (id, nome, ativo)
  values (_user_id, nullif(btrim(coalesce(_nome, '')), ''), coalesce(_ativo, true))
  on conflict (id) do update
    set nome = excluded.nome,
        ativo = excluded.ativo;

  -- Papel
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);

  -- Permissões (admin acessa tudo)
  if _role = 'admin' then
    delete from public.user_permissions where user_id = _user_id;
  else
    for p in select * from jsonb_array_elements(coalesce(_permissions, '[]'::jsonb))
    loop
      if not ((p->>'modulo') = any (allowed_modules)) then
        raise exception 'Módulo inválido: %', coalesce(p->>'modulo','(nulo)') using errcode = '22023';
      end if;

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

    delete from public.user_permissions up
    where up.user_id = _user_id
      and up.modulo not in (
        select x->>'modulo' from jsonb_array_elements(coalesce(_permissions, '[]'::jsonb)) x
      );
  end if;

  -- Bloqueio real de autenticação quando inativo
  if coalesce(_ativo, true) = false then
    update auth.users set banned_until = 'infinity'::timestamptz where id = _user_id;
    delete from auth.refresh_tokens where user_id = _user_id::text;
    delete from auth.sessions where user_id = _user_id;
  else
    update auth.users set banned_until = null where id = _user_id;
  end if;

  select jsonb_build_object(
    'user_id', _user_id,
    'nome', (select nome from public.profiles where id = _user_id),
    'ativo', (select ativo from public.profiles where id = _user_id),
    'role', (select role from public.user_roles where user_id = _user_id limit 1),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'modulo', modulo, 'can_view', can_view, 'can_edit', can_edit, 'can_delete', can_delete
      ) order by modulo)
      from public.user_permissions where user_id = _user_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_save_user(uuid, text, boolean, public.app_role, jsonb) from public, anon;
grant execute on function public.admin_save_user(uuid, text, boolean, public.app_role, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
