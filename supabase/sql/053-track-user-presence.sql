-- ELO Transporte e Turismo — 053: Rastreamento de Presença de Usuários
-- Adiciona campos para rastrear em qual página o usuário está e quando foi visto pela última vez.

begin;

-- 1) Adiciona colunas ao perfil para rastreio
alter table public.profiles 
add column if not exists last_seen_at timestamptz,
add column if not exists last_seen_page text;

-- 2) Função para atualizar a presença (Security Definer)
create or replace function public.update_user_presence(_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_seen_at = now(),
      last_seen_page = _path
  where id = auth.uid();
end;
$$;

revoke all on function public.update_user_presence(text) from public, anon;
grant execute on function public.update_user_presence(text) to authenticated;

-- 3) Atualiza admin_list_users para incluir esses campos
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not (public.is_admin() or public.can('usuarios', 'view')) then
    raise exception 'Sem permissão para listar usuários' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(u order by u.email), '[]'::jsonb) into v_result
  from (
    select
      p.id,
      p.email,
      p.nome,
      p.ativo,
      p.created_at,
      au.last_sign_in_at,
      coalesce(public.has_role(p.id, 'admin'), false) as is_admin,
      s.created_at as sessao_iniciada_em,
      s.refreshed_at as sessao_atualizada_em,
      host(s.ip) as sessao_ip,
      s.user_agent as sessao_user_agent,
      (s.id is not null and p.last_seen_at > now() - interval '5 minutes') as online,
      p.last_seen_at,
      p.last_seen_page,
      coalesce((
        select jsonb_object_agg(
          up.modulo,
          jsonb_build_object('view', up.can_view, 'edit', up.can_edit, 'delete', up.can_delete)
        )
        from public.user_permissions up where up.user_id = p.id
      ), '{}'::jsonb) as permissoes
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join lateral (
      select se.id, se.created_at, se.refreshed_at, se.ip, se.user_agent
      from auth.sessions se
      where se.user_id = p.id
        and (se.not_after is null or se.not_after > now())
      order by se.created_at desc
      limit 1
    ) s on true
  ) u;

  return v_result;
end;
$$;

commit;

notify pgrst, 'reload schema';
