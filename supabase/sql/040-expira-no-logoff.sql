-- 040: expõe o flag "remember" da sessão para o card de usuários
-- Quando o usuário NÃO marcou "Ficar conectado por 30 dias",
-- o sistema mostra "No logoff" no lugar da contagem regressiva.

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
      case
        when s.id is null then null
        when m.session_id = s.id then m.expira_em
        else coalesce(s.not_after, coalesce(s.refreshed_at, s.created_at) + interval '30 days')
      end as sessao_expira_em,
      case
        when s.id is null then null
        when m.session_id = s.id then coalesce(m.remember, false)
        else null
      end as sessao_remember,
      host(s.ip) as sessao_ip,
      s.user_agent as sessao_user_agent,
      (s.id is not null) as online,
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
      select se.id, se.created_at, se.refreshed_at, se.not_after, se.ip, se.user_agent
      from auth.sessions se
      where se.user_id = p.id
        and (se.not_after is null or se.not_after > now())
      order by coalesce(se.refreshed_at, se.created_at) desc
      limit 1
    ) s on true
    left join public.user_session_meta m
      on m.user_id = p.id and m.session_id = s.id
  ) u;

  return v_result;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
