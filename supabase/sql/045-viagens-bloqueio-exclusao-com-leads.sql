-- =====================================================================
-- 045 - Bloqueia exclusão de viagens que possuem leads cadastrados
-- Antes, crm_lead_viagens usava ON DELETE CASCADE e a viagem era
-- excluída junto com os vínculos dos leads.
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

create or replace function public.viagens_bloqueia_exclusao_com_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  select count(distinct lv.lead_id) into v_qtd
    from public.crm_lead_viagens lv
   where lv.viagem_id = old.id;

  if v_qtd > 0 then
    raise exception
      'Esta viagem possui % lead(s) cadastrado(s) e não pode ser excluída.', v_qtd
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists viagens_bloqueia_exclusao_com_leads_trg on public.viagens;
create trigger viagens_bloqueia_exclusao_com_leads_trg
before delete on public.viagens
for each row execute function public.viagens_bloqueia_exclusao_com_leads();

commit;
