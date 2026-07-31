-- =====================================================================
-- 016 - Landing pages de viagens (modelos + captura de leads)
-- Banco: Supabase auto-hospedado
-- Executar após 015.
-- =====================================================================

begin;

-- 1) Campos da landing page na viagem ---------------------------------
alter table public.viagens
  add column if not exists landing_modelo text    not null default 'aurora',
  add column if not exists landing_slug   text,
  add column if not exists landing_ativa  boolean not null default true;

comment on column public.viagens.landing_modelo is 'Chave do modelo visual da landing page';
comment on column public.viagens.landing_slug   is 'Endereço público da landing page (/v/{slug})';
comment on column public.viagens.landing_ativa  is 'Se falso, a landing page fica indisponível';

-- Preenche slugs vazios a partir do destino
update public.viagens v
set landing_slug = trim(both '-' from
      regexp_replace(
        lower(translate(coalesce(v.destino, 'viagem'),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
        '[^a-z0-9]+', '-', 'g')
    ) || '-' || substr(v.id::text, 1, 6)
where v.landing_slug is null or btrim(v.landing_slug) = '';


create unique index if not exists viagens_landing_slug_uidx
  on public.viagens (landing_slug) where landing_slug is not null;

-- 2) Origem padrão dos leads vindos da landing page --------------------
insert into public.crm_origens (nome, posicao, ativo)
values ('Landing Page', 100, true)
on conflict (nome) do nothing;

-- 3) Leitura pública da landing page -----------------------------------
create or replace function public.landing_viagem(_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_row public.viagens;
begin
  select * into v_row
  from public.viagens
  where landing_slug = _slug and landing_ativa = true
  limit 1;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id',            v_row.id,
    'titulo',        v_row.titulo,
    'subtitulo',     v_row.subtitulo,
    'descricao',     v_row.descricao,
    'destino',       v_row.destino,
    'data_partida',  v_row.data_partida,
    'hora_partida',  v_row.hora_partida,
    'valor',         v_row.valor,
    'vagas',         v_row.vagas,
    'itens_inclusos',v_row.itens_inclusos,
    'imagens',       v_row.imagens,
    'situacao',      v_row.situacao,
    'modelo',        v_row.landing_modelo,
    'slug',          v_row.landing_slug
  );
end;
$$;

grant execute on function public.landing_viagem(text) to anon, authenticated;

-- 4) Captura de lead pela landing page ---------------------------------
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
