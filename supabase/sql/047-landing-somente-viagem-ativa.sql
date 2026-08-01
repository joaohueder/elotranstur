-- 047 - Landing page pública somente para viagens com situação "ativa"

begin;

-- landing_viagem: só retorna a viagem quando a landing está ativa E a situação é "ativa"
create or replace function public.landing_viagem(_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_titulo        text;
  v_subtitulo     text;
  v_descricao     text;
  v_destino       text;
  v_uf            text;
  v_data_partida  date;
  v_hora_partida  time;
  v_valor         numeric;
  v_vagas         integer;
  v_itens_inclusos text[];
  v_imagens       jsonb;
  v_situacao      public.viagem_situacao;
  v_modelo        text;
  v_paleta        text;
  v_landing_slug  text;
begin
  select
    v.id, v.titulo, v.subtitulo, v.descricao, v.destino, d.uf,
    v.data_partida, v.hora_partida, v.valor, v.vagas, v.itens_inclusos,
    v.imagens, v.situacao, v.landing_modelo, v.landing_paleta, v.landing_slug
  into
    v_id, v_titulo, v_subtitulo, v_descricao, v_destino, v_uf,
    v_data_partida, v_hora_partida, v_valor, v_vagas, v_itens_inclusos,
    v_imagens, v_situacao, v_modelo, v_paleta, v_landing_slug
  from public.viagens v
  left join public.destinos d on d.nome = v.destino
  where v.landing_slug = _slug
    and v.landing_ativa = true
    and v.situacao = 'ativa'
  limit 1;

  if v_id is null then
    return null;
  end if;

  return json_build_object(
    'id',            v_id,
    'titulo',        v_titulo,
    'subtitulo',     v_subtitulo,
    'descricao',     v_descricao,
    'destino',       v_destino,
    'uf',            v_uf,
    'data_partida',  v_data_partida,
    'hora_partida',  v_hora_partida,
    'valor',         v_valor,
    'vagas',         v_vagas,
    'itens_inclusos',v_itens_inclusos,
    'imagens',       v_imagens,
    'situacao',      v_situacao,
    'modelo',        v_modelo,
    'paleta',        v_paleta,
    'slug',          v_landing_slug
  );
end;
$$;

grant execute on function public.landing_viagem(text) to anon, authenticated;

-- landing_lead: recusa envios de viagens que não estejam ativas
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
  where landing_slug = _slug
    and landing_ativa = true
    and situacao = 'ativa'
  limit 1;

  if not found then
    return json_build_object('ok', false, 'message', 'Esta viagem não está mais disponível.');
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
    null; -- vinculo com a viagem e opcional; nao deve impedir o lead
  end;

  return json_build_object('ok', true, 'lead_id', v_lead);
exception when others then
  return json_build_object('ok', false,
    'message', 'Erro ao salvar o lead: ' || sqlerrm,
    'code', sqlstate);
end;
$$;

grant execute on function public.landing_lead(text, text, text) to anon, authenticated;

commit;
