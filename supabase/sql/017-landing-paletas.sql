-- =====================================================================
-- 017 - Landing pages: paleta de cores separada do modelo
-- Banco: Supabase auto-hospedado
-- Executar após 016.
-- =====================================================================

begin;

-- 1) Nova coluna de paleta ---------------------------------------------
alter table public.viagens
  add column if not exists landing_paleta text not null default 'areia-dourada';

comment on column public.viagens.landing_paleta is
  'Chave da paleta de cores da landing page (independente do modelo)';

-- 2) Modelos antigos que não existem mais viram o modelo padrão --------
update public.viagens
set landing_modelo = 'aurora'
where landing_modelo not in (
  'aurora','impacto','diagonal','editorial','cartaz','bilhete','flutuante',
  'sereno','horizonte','expresso','convite','holofote','camadas','stories','painel'
);

-- 3) Leitura pública da landing page agora devolve a paleta ------------
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
    'paleta',        v_row.landing_paleta,
    'slug',          v_row.landing_slug
  );
end;
$$;

grant execute on function public.landing_viagem(text) to anon, authenticated;

commit;
