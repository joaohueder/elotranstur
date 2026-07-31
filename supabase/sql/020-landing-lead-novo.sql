-- =====================================================================
-- 020 - Landing page: captura de lead sempre como NOVO lead
-- Banco: Supabase auto-hospedado
-- Executar após 019.
-- =====================================================================

begin;

-- Garante a origem "Landing Page" cadastrada no CRM
insert into public.crm_origens (nome, ativo, posicao)
select 'Landing Page', true,
       coalesce((select max(posicao) + 1 from public.crm_origens), 0)
where not exists (select 1 from public.crm_origens where nome = 'Landing Page');

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
  v_digits  text;
begin
  v_digits := regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g');

  if coalesce(btrim(_nome), '') = '' or length(v_digits) < 10 then
    return json_build_object('ok', false, 'message', 'Informe seu nome e um WhatsApp válido com DDD.');
  end if;

  select * into v_viagem
  from public.viagens
  where landing_slug = _slug and landing_ativa = true
  limit 1;

  if not found then
    return json_build_object('ok', false, 'message', 'Viagem não encontrada.');
  end if;

  -- Primeira etapa ativa do CRM (etapa de entrada = "novo lead")
  select id into v_stage
  from public.crm_stages
  where ativo = true
  order by posicao asc, created_at asc
  limit 1;

  if v_stage is null then
    insert into public.crm_stages (nome, posicao, ativo)
    values ('Novo Lead', 0, true)
    returning id into v_stage;
  end if;

  -- Sempre cria um novo lead, no topo da primeira etapa
  insert into public.crm_leads (nome, whatsapp, origem, stage_id, posicao)
  values (
    btrim(_nome),
    case
      when length(v_digits) = 11 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,5) || '-' || substr(v_digits,8,4)
      when length(v_digits) = 10 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,4) || '-' || substr(v_digits,7,4)
      else v_digits
    end,
    'Landing Page',
    v_stage,
    coalesce((select min(posicao) - 1 from public.crm_leads where stage_id = v_stage), 0)
  )
  returning id into v_lead;

  insert into public.crm_lead_viagens (lead_id, viagem_id)
  values (v_lead, v_viagem.id)
  on conflict do nothing;

  return json_build_object('ok', true, 'lead_id', v_lead);
end;
$$;

grant execute on function public.landing_lead(text, text, text) to anon, authenticated;

commit;
