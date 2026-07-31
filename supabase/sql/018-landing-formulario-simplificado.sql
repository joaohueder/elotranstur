-- =====================================================================
-- 018 - Landing pages: formulário simplificado (nome + WhatsApp)
-- Banco: Supabase auto-hospedado
-- Executar após 017.
-- =====================================================================

begin;

-- O formulário de lead agora pede apenas nome e WhatsApp.
-- Remove o campo de mensagem da função pública de captura.
create or replace function public.landing_lead(
  _slug     text,
  _nome     text,
  _whatsapp text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_viagem  public.viagens;
  v_stage   uuid;
  v_lead    uuid;
begin
  if coalesce(btrim(_nome), '') = '' or coalesce(btrim(_whatsapp), '') = '' then
    return json_build_object('ok', false, 'message', 'Informe seu nome e WhatsApp.');
  end if;

  select * into v_viagem
  from public.viagens
  where landing_slug = _slug and landing_ativa = true
  limit 1;

  if not found then
    return json_build_object('ok', false, 'message', 'Viagem não encontrada.');
  end if;

  select id into v_stage
  from public.crm_stages
  where ativo = true
  order by posicao asc, created_at asc
  limit 1;

  insert into public.crm_leads (nome, whatsapp, origem, stage_id, posicao)
  values (btrim(_nome), btrim(_whatsapp), 'Landing Page', v_stage, 0)
  returning id into v_lead;

  insert into public.crm_lead_viagens (lead_id, viagem_id)
  values (v_lead, v_viagem.id)
  on conflict do nothing;

  return json_build_object('ok', true, 'lead_id', v_lead);
end;
$$;

grant execute on function public.landing_lead(text, text, text) to anon, authenticated;

commit;
