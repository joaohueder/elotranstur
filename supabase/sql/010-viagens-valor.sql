-- =====================================================================
-- 010 - Viagens: valor da viagem
-- Banco: Supabase auto-hospedado
-- Executar após 009.
-- =====================================================================

begin;

alter table public.viagens
  add column if not exists valor numeric(12,2) not null default 0;

commit;
