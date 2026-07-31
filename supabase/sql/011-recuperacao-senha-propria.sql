-- =====================================================================
-- 011 - Recuperação de senha própria (sem e-mail padrão do Supabase)
-- O sistema gera um código de 6 dígitos, envia pelo SMTP configurado em
-- Configurações > E-mail e valida tudo pela Edge Function password-reset.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  reset_token text,
  attempts integer not null default 0,
  verified_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_codes_email_idx
  on public.password_reset_codes (email, created_at desc);
create index if not exists password_reset_codes_token_idx
  on public.password_reset_codes (reset_token);

-- Tabela sensível: acesso somente pelo service_role (Edge Function).
revoke all on public.password_reset_codes from anon, authenticated;
grant all on public.password_reset_codes to service_role;

alter table public.password_reset_codes enable row level security;
-- Sem policies: nenhum acesso direto pelo cliente.

-- Busca o id do usuário pelo e-mail (usada apenas pela Edge Function).
create or replace function public.find_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth, extensions
as $$
  select id from auth.users
  where lower(email) = lower(trim(_email))
  limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
