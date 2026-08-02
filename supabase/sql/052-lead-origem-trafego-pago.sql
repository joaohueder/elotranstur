-- =====================================================================
-- 052 - Origem "Tráfego Pago" (Meta Ads) detectada pelo registro da visita
-- Banco: Supabase auto-hospedado · idempotente
-- Executar após 051.
-- =====================================================================

begin;

-- 1) Origem de sistema (não pode ser editada nem excluída)
insert into public.crm_origens (nome, ativo, sistema, posicao)
select 'Tráfego Pago', true, true,
       coalesce((select max(posicao) + 1 from public.crm_origens), 0)
where not exists (select 1 from public.crm_origens where nome = 'Tráfego Pago');

update public.crm_origens
   set sistema = true, ativo = true
 where nome = 'Tráfego Pago';

-- 2) Detecta se a visita veio de anúncio da Meta (Facebook / Instagram).
--    Não usa UTM: olha o clique de anúncio (fbclid) e o referenciador da visita.
create or replace function public.visita_de_meta_ads(_visitor text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_visitas v
    where v.visitor_id = _visitor
      and v.created_at > now() - interval '30 days'
      and (
        coalesce(v.fbclid, '') <> ''
        or coalesce(v.detalhes->>'fbclid', '') <> ''
        or v.referrer ~* '(facebook\.|fb\.com|fb\.me|instagram\.|l\.instagram|lm\.facebook)'
        or coalesce(v.query, '') ~* 'fbclid='
      )
  );
$$;

revoke all on function public.visita_de_meta_ads(text) from public;
grant execute on function public.visita_de_meta_ads(text) to anon, authenticated;

-- 3) landing_lead passa a receber o identificador do visitante e a gravar
--    a origem "Tráfego Pago" quando a visita veio da Meta Ads.
drop function if exists public.landing_lead(text, text, text);

create or replace function public.landing_lead(
  _slug     text,
  _nome     text,
  _whatsapp text,
  _visitor  text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_viagem   public.viagens;
  v_stage    uuid;
  v_lead     uuid;
  v_digits   text;
  v_nome     text;
  v_headers  jsonb;
  v_ip       text;
  v_envios   integer;
  v_origem   text := 'Landing Page';
begin
  v_nome := btrim(regexp_replace(coalesce(_nome, ''), '[[:cntrl:]]', '', 'g'));
  v_nome := left(v_nome, 120);
  v_digits := left(regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g'), 15);

  if v_nome = '' or length(v_nome) < 2 or length(v_digits) < 10 then
    return json_build_object('ok', false,
      'message', 'Informe seu nome e um WhatsApp válido com DDD.');
  end if;

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip := coalesce(nullif(btrim(split_part(coalesce(
            nullif(v_headers->>'cf-connecting-ip', ''),
            nullif(v_headers->>'x-real-ip', ''),
            nullif(v_headers->>'x-forwarded-for', ''),
            ''), ',', 1)), ''), 'desconhecido');

  delete from public.landing_lead_hits where criado_em < now() - interval '1 day';

  select count(*) into v_envios
  from public.landing_lead_hits
  where ip = v_ip and criado_em > now() - interval '10 minutes';

  if v_envios >= 5 then
    return json_build_object('ok', false,
      'message', 'Muitos envios em pouco tempo. Tente novamente em alguns minutos.');
  end if;

  insert into public.landing_lead_hits (ip) values (v_ip);

  select * into v_viagem
  from public.viagens
  where landing_slug = _slug
    and landing_ativa = true
    and situacao = 'ativa'
  limit 1;

  if not found then
    return json_build_object('ok', false,
      'message', 'Esta viagem não está mais disponível.');
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

  -- Origem pelo registro da visita (sem UTM): anúncio da Meta => Tráfego Pago
  if coalesce(_visitor, '') <> '' and public.visita_de_meta_ads(_visitor) then
    v_origem := 'Tráfego Pago';
  end if;

  insert into public.crm_leads (nome, whatsapp, origem, stage_id, posicao)
  values (
    v_nome,
    case
      when length(v_digits) = 11 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,5) || '-' || substr(v_digits,8,4)
      when length(v_digits) = 10 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,4) || '-' || substr(v_digits,7,4)
      else v_digits
    end,
    v_origem,
    v_stage,
    coalesce((select min(posicao) - 1 from public.crm_leads where stage_id = v_stage), 0)
  )
  returning id into v_lead;

  begin
    insert into public.crm_lead_viagens (lead_id, viagem_id)
    values (v_lead, v_viagem.id)
    on conflict do nothing;
  exception when others then
    null;
  end;

  return json_build_object('ok', true, 'lead_id', v_lead, 'origem', v_origem);
exception when others then
  raise warning 'landing_lead falhou: % (%)', sqlerrm, sqlstate;
  return json_build_object('ok', false,
    'message', 'Não foi possível enviar agora. Tente novamente em instantes.');
end;
$$;

revoke all on function public.landing_lead(text, text, text, text) from public;
grant execute on function public.landing_lead(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
