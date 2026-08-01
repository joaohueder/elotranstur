-- =====================================================================
-- 050 - Configurações › Empresa: e-mails adicionais em cópia (CC)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

alter table public.app_empresa
  add column if not exists emails_copia text not null default '';

-- Salvar dados da empresa (agora com e-mails em cópia)
create or replace function public.save_empresa_settings(
  _nome text,
  _whatsapp text,
  _email text default '',
  _emails_copia text default ''
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _item text;
  _limpos text[] := '{}';
begin
  if not (public.is_admin() or public.can('configuracoes', 'edit')) then
    raise exception 'Sem permissão para alterar os dados da empresa';
  end if;

  if coalesce(_email, '') <> '' and _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail da empresa inválido';
  end if;

  foreach _item in array string_to_array(coalesce(_emails_copia, ''), ',') loop
    _item := btrim(_item);
    if _item <> '' then
      if _item !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'E-mail em cópia inválido: %', _item;
      end if;
      _limpos := _limpos || _item;
    end if;
  end loop;

  insert into public.app_empresa (id, nome, whatsapp, email, emails_copia)
  values (
    true,
    coalesce(_nome, ''),
    coalesce(_whatsapp, ''),
    coalesce(_email, ''),
    array_to_string(_limpos, ', ')
  )
  on conflict (id) do update
    set nome = excluded.nome,
        whatsapp = excluded.whatsapp,
        email = excluded.email,
        emails_copia = excluded.emails_copia;
end;
$$;

revoke all on function public.save_empresa_settings(text, text, text, text) from public;
grant execute on function public.save_empresa_settings(text, text, text, text) to authenticated;

-- Remove a assinatura antiga (3 parâmetros) para evitar ambiguidade
drop function if exists public.save_empresa_settings(text, text, text);

commit;
