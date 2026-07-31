-- =====================================================================
-- 021 - Corrige envio do lead pela landing page pública
-- Banco: Supabase auto-hospedado
-- Executar após 020. Idempotente: pode rodar quantas vezes precisar.
-- =====================================================================

begin;

-- 1) Origem padrão usada pelas landing pages
insert into public.crm_origens (nome, ativo, posicao)
select 'Landing Page', true,
       coalesce((select max(posicao) + 1 from public.crm_origens), 0)
where not exists (select 1 from public.crm_origens where nome = 'Landing Page');

-- 2) Recria a função (com tratamento de exceção para retornar o erro real)
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
    return json_build_object('ok', false, 'message', 'Viagem não encontrada ou landing page desativada.');
  end if;

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

  begin
    insert into public.crm_lead_viagens (lead_id, viagem_id)
    values (v_lead, v_viagem.id)
    on conflict do nothing;
  exception when others then
    null; -- vínculo com a viagem é opcional; não deve impedir o lead
  end;

  return json_build_object('ok', true, 'lead_id', v_lead);
exception when others then
  return json_build_object('ok', false,
    'message', 'Erro ao salvar o lead: ' || sqlerrm,
    'code', sqlstate);
end;
$$;

-- 3) Permissões: a landing page é pública (anon)
grant usage on schema public to anon, authenticated;
grant execute on function public.landing_lead(text, text, text) to anon, authenticated;

-- 4) Leitura pública da viagem publicada (necessária para abrir a landing)
grant select on public.viagens to anon;

commit;
