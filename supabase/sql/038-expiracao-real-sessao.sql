-- =========================================================
-- 038 - Expiração real da sessão (30 dias x 6 horas)
-- =========================================================
-- O banco não sabe se o usuário marcou "Ficar conectado por 30 dias",
-- então o card sempre mostrava 30 dias. Agora o app registra a escolha
-- no login e o admin_list_users usa esse valor.
-- =========================================================

create table if not exists public.user_session_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  remember boolean not null default false,
  expira_em timestamptz not null,
  registrado_em timestamptz not null default now()
);

grant select, insert, update on public.user_session_meta to authenticated;
grant all on public.user_session_meta to service_role;

alter table public.user_session_meta enable row level security;

drop policy if exists "usuario le a propria sessao" on public.user_session_meta;
create policy "usuario le a propria sessao"
on public.user_session_meta for select to authenticated
using (user_id = auth.uid() or public.is_admin() or public.can('usuarios', 'view'));

drop policy if exists "usuario grava a propria sessao" on public.user_session_meta;
create policy "usuario grava a propria sessao"
on public.user_session_meta for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RPC chamada logo após o login
create or replace function public.registrar_expiracao_sessao(p_remember boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exp timestamptz;
begin
  if v_uid is null then
    raise exception 'Sessão não autenticada' using errcode = '42501';
  end if;

  v_exp := now() + case when p_remember then interval '30 days' else interval '6 hours' end;

  insert into public.user_session_meta (user_id, remember, expira_em, registrado_em)
  values (v_uid, coalesce(p_remember, false), v_exp, now())
  on conflict (user_id) do update
    set remember = excluded.remember,
        expira_em = excluded.expira_em,
        registrado_em = excluded.registrado_em;

  return v_exp;
end;
$$;

revoke all on function public.registrar_expiracao_sessao(boolean) from public, anon;
grant execute on function public.registrar_expiracao_sessao(boolean) to authenticated;

-- Lista de usuários usando a expiração real
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
        when m.expira_em is not null
             and m.registrado_em >= s.created_at - interval '2 minutes'
          then m.expira_em
        else coalesce(
          s.not_after,
          coalesce(s.refreshed_at, s.created_at) + interval '30 days'
        )
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
    left join public.user_session_meta m on m.user_id = p.id
    left join lateral (
      select se.id, se.created_at, se.refreshed_at, se.not_after, se.ip, se.user_agent
      from auth.sessions se
      where se.user_id = p.id
        and (se.not_after is null or se.not_after > now())
      order by coalesce(se.refreshed_at, se.created_at) desc
      limit 1
    ) s on true
  ) u;

  return v_result;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
