-- =========================================================
-- 039 - Vincula a expiração à sessão exata do login
-- =========================================================
-- Corrige dois problemas:
-- 1) diferencia sessões simultâneas do mesmo usuário;
-- 2) garante que admin_list_users use a escolha feita no login atual.
-- =========================================================

alter table public.user_session_meta
  add column if not exists session_id uuid;

create index if not exists idx_user_session_meta_session_id
  on public.user_session_meta (session_id);

create or replace function public.registrar_expiracao_sessao(p_remember boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_exp timestamptz;
begin
  if v_uid is null then
    raise exception 'Sessão não autenticada' using errcode = '42501';
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_session_id := null;
  end;

  -- Compatibilidade com versões self-hosted que não incluem session_id no JWT.
  if v_session_id is null then
    select s.id into v_session_id
    from auth.sessions s
    where s.user_id = v_uid
    order by coalesce(s.refreshed_at, s.created_at) desc
    limit 1;
  end if;

  if v_session_id is null then
    raise exception 'Não foi possível identificar a sessão atual' using errcode = 'P0001';
  end if;

  v_exp := now() + case
    when coalesce(p_remember, false) then interval '30 days'
    else interval '6 hours'
  end;

  insert into public.user_session_meta
    (user_id, session_id, remember, expira_em, registrado_em)
  values
    (v_uid, v_session_id, coalesce(p_remember, false), v_exp, now())
  on conflict (user_id) do update
    set session_id = excluded.session_id,
        remember = excluded.remember,
        expira_em = excluded.expira_em,
        registrado_em = excluded.registrado_em;

  return v_exp;
end;
$$;

revoke all on function public.registrar_expiracao_sessao(boolean) from public, anon;
grant execute on function public.registrar_expiracao_sessao(boolean) to authenticated;

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