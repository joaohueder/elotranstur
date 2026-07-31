begin;

-- Inclui a UF do destino no retorno da landing page,
-- permitindo montar a mensagem do WhatsApp no formato "Destino / UF".
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
    v.id,
    v.titulo,
    v.subtitulo,
    v.descricao,
    v.destino,
    d.uf,
    v.data_partida,
    v.hora_partida,
    v.valor,
    v.vagas,
    v.itens_inclusos,
    v.imagens,
    v.situacao,
    v.landing_modelo,
    v.landing_paleta,
    v.landing_slug
  into
    v_id, v_titulo, v_subtitulo, v_descricao, v_destino, v_uf,
    v_data_partida, v_hora_partida, v_valor, v_vagas, v_itens_inclusos,
    v_imagens, v_situacao, v_modelo, v_paleta, v_landing_slug
  from public.viagens v
  left join public.destinos d on d.nome = v.destino
  where v.landing_slug = _slug and v.landing_ativa = true
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

commit;
