-- Permite que a tela de login diferencie "credenciais inválidas" de "conta bloqueada".
-- O GoTrue auto-hospedado devolve sempre "Invalid login credentials" para usuários banidos,
-- então expomos apenas um booleano (nenhum dado pessoal é retornado).

begin;

create or replace function public.login_is_blocked(_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(_email))
      and (
        (u.banned_until is not null and u.banned_until > now())
        or coalesce(p.ativo, true) = false
      )
  );
$$;

revoke all on function public.login_is_blocked(text) from public;
grant execute on function public.login_is_blocked(text) to anon, authenticated;

commit;

-- Recarrega o schema do PostgREST
notify pgrst, 'reload schema';
