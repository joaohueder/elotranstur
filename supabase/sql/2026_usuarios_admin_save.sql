-- ELO — Salvamento de usuário (admin), transacional, validado e à prova de RLS
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

-- 3) Salvamento administrativo: valida entradas e retorna o estado gravado
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
  allowed_modules constant text[] := array['usuarios','configuracoes'];
  p            jsonb;
  perms        jsonb := coalesce(_permissions, '[]'::jsonb);
  nome_norm    text  := nullif(btrim(coalesce(_nome, '')), '');
  ativo_norm   boolean := coalesce(_ativo, true);
  modulos      text[] := '{}';
  modulo       text;
  can_view     boolean;
  can_edit     boolean;
  can_delete   boolean;
  result       jsonb;
begin
  -- 3.1) Autorização
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar usuários.' using errcode = '42501';
  end if;

  -- 3.2) Validação de entradas
  if _user_id is null then
    raise exception 'user_id é obrigatório.' using errcode = '22023';
  end if;

  if _role is null then
    raise exception 'Perfil (role) é obrigatório.' using errcode = '22023';
  end if;

  if nome_norm is not null and char_length(nome_norm) > 120 then
    raise exception 'Nome deve ter no máximo 120 caracteres.' using errcode = '22023';
  end if;

  if jsonb_typeof(perms) <> 'array' then
    raise exception 'permissions deve ser um array JSON.' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = _user_id) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  -- 3.3) Proteções contra auto-bloqueio do administrador logado
  if _user_id = auth.uid() and _role <> 'admin' then
    raise exception 'Você não pode remover seu próprio perfil de administrador.' using errcode = '42501';
  end if;

  if _user_id = auth.uid() and ativo_norm = false then
    raise exception 'Você não pode desativar sua própria conta.' using errcode = '42501';
  end if;

  -- 3.4) Perfil
  insert into public.profiles (id, nome, ativo)
  values (_user_id, nome_norm, ativo_norm)
  on conflict (id) do update
    set nome = excluded.nome,
        ativo = excluded.ativo;

  -- 3.5) Papel
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);

  -- 3.6) Permissões (admin acessa tudo, portanto não há linhas granulares)
  if _role = 'admin' then
    delete from public.user_permissions where user_id = _user_id;
  else
    for p in select * from jsonb_array_elements(perms)
    loop
      if jsonb_typeof(p) <> 'object' then
        raise exception 'Cada permissão deve ser um objeto JSON.' using errcode = '22023';
      end if;

      modulo := p->>'modulo';

      if modulo is null or not (modulo = any (allowed_modules)) then
        raise exception 'Módulo inválido: %', coalesce(modulo, '(nulo)') using errcode = '22023';
      end if;

      if modulo = any (modulos) then
        raise exception 'Módulo duplicado: %', modulo using errcode = '22023';
      end if;
      modulos := modulos || modulo;

      can_view   := coalesce((p->>'can_view')::boolean, false);
      can_edit   := coalesce((p->>'can_edit')::boolean, false);
      can_delete := coalesce((p->>'can_delete')::boolean, false);

      -- Coerência: editar/excluir exige visualizar
      if (can_edit or can_delete) and not can_view then
        can_view := true;
      end if;

      insert into public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
      values (_user_id, modulo, can_view, can_edit, can_delete)
      on conflict (user_id, modulo) do update
        set can_view   = excluded.can_view,
            can_edit   = excluded.can_edit,
            can_delete = excluded.can_delete;
    end loop;

    -- Remove módulos não enviados nesta gravação
    delete from public.user_permissions up
    where up.user_id = _user_id
      and not (up.modulo = any (modulos));
  end if;

  -- 3.7) Bloqueio real de autenticação quando inativo
  if ativo_norm = false then
    update auth.users set banned_until = 'infinity'::timestamptz where id = _user_id;
    delete from auth.refresh_tokens where user_id = _user_id::text;
    delete from auth.sessions where user_id = _user_id;
  else
    update auth.users set banned_until = null where id = _user_id;
  end if;

  -- 3.8) Estado efetivamente gravado (evita falso negativo por RLS na leitura)
  select jsonb_build_object(
    'user_id', _user_id,
    'email', (select u.email from auth.users u where u.id = _user_id),
    'nome', (select pr.nome from public.profiles pr where pr.id = _user_id),
    'ativo', (select pr.ativo from public.profiles pr where pr.id = _user_id),
    'role', (select ur.role from public.user_roles ur where ur.user_id = _user_id limit 1),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'modulo', up.modulo,
        'can_view', up.can_view,
        'can_edit', up.can_edit,
        'can_delete', up.can_delete
      ) order by up.modulo)
      from public.user_permissions up
      where up.user_id = _user_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_save_user(uuid, text, boolean, public.app_role, jsonb) from public, anon;
grant execute on function public.admin_save_user(uuid, text, boolean, public.app_role, jsonb) to authenticated;

-- 4) Limpa permissões de módulos que não existem mais
delete from public.user_permissions where modulo <> all (array['usuarios','configuracoes']);

commit;

notify pgrst, 'reload schema';
