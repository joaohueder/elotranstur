-- 030 · Lista pública dos endereços das landing pages ativas
-- Usada na geração da prévia de compartilhamento (WhatsApp/Facebook/Telegram)
-- durante o build do site: para cada slug é gravado um HTML real com a foto
-- de capa, o título e o subtítulo da viagem.

create or replace function public.landing_slugs()
returns table (slug text)
language sql
stable
security definer
set search_path = public
as $$
  select landing_slug
  from public.viagens
  where landing_ativa = true
    and landing_slug is not null
    and btrim(landing_slug) <> ''
  order by data_partida
$$;

revoke all on function public.landing_slugs() from public;
grant execute on function public.landing_slugs() to anon, authenticated;
