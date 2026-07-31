-- =====================================================================
-- 006 - Módulo Configurações · Aba E-mail (SMTP do sistema)
-- Banco: Supabase auto-hospedado
-- Somente administradores podem ler/gravar.
-- =====================================================================

create table if not exists public.app_email_settings (
  id boolean primary key default true,
  smtp_host text not null default '',
  smtp_port integer not null default 587,
  smtp_user text not null default '',
  smtp_password text not null default '',
  smtp_secure boolean not null default true,
  from_name text not null default 'ELO Transporte e Turismo',
  from_email text not null default '',
  reply_to text not null default '',
  ativo boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint app_email_settings_singleton check (id),
  constraint app_email_settings_port_range check (smtp_port between 1 and 65535)
);

grant select, insert, update on public.app_email_settings to authenticated;
grant all on public.app_email_settings to service_role;

alter table public.app_email_settings enable row level security;

-- Nenhuma policy para authenticated: o acesso é feito apenas pelas
-- funções SECURITY DEFINER abaixo, que validam se o usuário é admin.

create or replace function public.get_email_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_row public.app_email_settings;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: somente administradores';
  end if;

  select * into v_row from public.app_email_settings where id;

  if not found then
    return jsonb_build_object(
      'smtp_host', '', 'smtp_port', 587, 'smtp_user', '',
      'smtp_password_set', false, 'smtp_secure', true,
      'from_name', 'ELO Transporte e Turismo', 'from_email', '',
      'reply_to', '', 'ativo', false
    );
  end if;

  return jsonb_build_object(
    'smtp_host', v_row.smtp_host,
    'smtp_port', v_row.smtp_port,
    'smtp_user', v_row.smtp_user,
    'smtp_password_set', coalesce(v_row.smtp_password, '') <> '',
    'smtp_secure', v_row.smtp_secure,
    'from_name', v_row.from_name,
    'from_email', v_row.from_email,
    'reply_to', v_row.reply_to,
    'ativo', v_row.ativo,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.get_email_settings() to authenticated;

-- Passe _smtp_password = null para manter a senha atual.
create or replace function public.save_email_settings(
  _smtp_host text,
  _smtp_port integer,
  _smtp_user text,
  _smtp_password text,
  _smtp_secure boolean,
  _from_name text,
  _from_email text,
  _reply_to text,
  _ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: somente administradores';
  end if;

  if _smtp_port is null or _smtp_port < 1 or _smtp_port > 65535 then
    raise exception 'Porta SMTP inválida';
  end if;

  if coalesce(_from_email, '') <> '' and _from_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail remetente inválido';
  end if;

  insert into public.app_email_settings as s (
    id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure,
    from_name, from_email, reply_to, ativo, updated_at, updated_by
  ) values (
    true, coalesce(_smtp_host, ''), _smtp_port, coalesce(_smtp_user, ''),
    coalesce(_smtp_password, ''), coalesce(_smtp_secure, true),
    coalesce(_from_name, ''), coalesce(_from_email, ''),
    coalesce(_reply_to, ''), coalesce(_ativo, false), now(), auth.uid()
  )
  on conflict (id) do update set
    smtp_host = excluded.smtp_host,
    smtp_port = excluded.smtp_port,
    smtp_user = excluded.smtp_user,
    smtp_password = case
      when _smtp_password is null then s.smtp_password
      else _smtp_password
    end,
    smtp_secure = excluded.smtp_secure,
    from_name = excluded.from_name,
    from_email = excluded.from_email,
    reply_to = excluded.reply_to,
    ativo = excluded.ativo,
    updated_at = now(),
    updated_by = auth.uid();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.save_email_settings(
  text, integer, text, text, boolean, text, text, text, boolean
) to authenticated;
