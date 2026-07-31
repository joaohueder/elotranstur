-- =====================================================================
-- 012 - Viagens: horário, textos, vagas e galeria de imagens
-- Banco: Supabase auto-hospedado
-- Executar após 011.
-- =====================================================================

begin;

-- 1) Novos campos da viagem -------------------------------------------
alter table public.viagens
  add column if not exists hora_partida time,
  add column if not exists titulo       text,
  add column if not exists subtitulo    text,
  add column if not exists descricao    text,
  add column if not exists vagas        integer not null default 0,
  -- Galeria: array ordenado de objetos {"url": "...", "path": "...", "capa": true|false}
  add column if not exists imagens      jsonb not null default '[]'::jsonb;

alter table public.viagens
  drop constraint if exists viagens_vagas_nao_negativa;
alter table public.viagens
  add constraint viagens_vagas_nao_negativa check (vagas >= 0);

comment on column public.viagens.hora_partida is 'Horário de embarque';
comment on column public.viagens.valor        is 'Valor por pessoa';
comment on column public.viagens.imagens      is 'Galeria ordenada; item com capa=true é a foto de capa';

-- 2) Bucket público da galeria de viagens ------------------------------
insert into storage.buckets (id, name, public)
values ('viagens', 'viagens', true)
on conflict (id) do update set public = true;

drop policy if exists "viagens_imgs_public_read" on storage.objects;
create policy "viagens_imgs_public_read" on storage.objects
for select to public
using (bucket_id = 'viagens');

drop policy if exists "viagens_imgs_insert" on storage.objects;
create policy "viagens_imgs_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'viagens'
  and (public.is_admin() or public.can('viagens', 'edit'))
);

drop policy if exists "viagens_imgs_update" on storage.objects;
create policy "viagens_imgs_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'viagens'
  and (public.is_admin() or public.can('viagens', 'edit'))
);

drop policy if exists "viagens_imgs_delete" on storage.objects;
create policy "viagens_imgs_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'viagens'
  and (public.is_admin() or public.can('viagens', 'delete') or public.can('viagens', 'edit'))
);

commit;
