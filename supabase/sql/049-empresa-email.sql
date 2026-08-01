-- =====================================================================
-- 049 - Configurações › Empresa: campo e-mail
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

alter table public.app_empresa
  add column if not exists email text not null default '';

-- Salvar dados da empresa (agora com e-mail)
create or replace function public.save_empresa_settings(
  _nome text,
  _whatsapp text,
  _email text default ''
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not (public.is_admin() or public.can('configuracoes', 'edit')) then
    raise exception 'Sem permissão para alterar os dados da empresa';
  end if;

  if coalesce(_email, '') <> '' and _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail da empresa inválido';
  end if;

  insert into public.app_empresa (id, nome, whatsapp, email)
  values (true, coalesce(_nome, ''), coalesce(_whatsapp, ''), coalesce(_email, ''))
  on conflict (id) do update
    set nome = excluded.nome,
        whatsapp = excluded.whatsapp,
        email = excluded.email;
end;
$$;

revoke all on function public.save_empresa_settings(text, text, text) from public;
grant execute on function public.save_empresa_settings(text, text, text) to authenticated;

-- Remove a assinatura antiga (2 parâmetros) para evitar ambiguidade
drop function if exists public.save_empresa_settings(text, text);

commit;
