-- =====================================================================
-- 044 - Corrige bloqueio de exclusão de destino em uso
-- As viagens gravam o destino como "Nome - UF"; o trigger antigo só
-- comparava com "Nome" e por isso permitia excluir destinos em uso.
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

create or replace function public.destinos_bloqueia_exclusao_em_uso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  select count(*) into v_qtd
    from public.viagens v
   where lower(btrim(v.destino)) in (
     lower(btrim(old.nome)),
     lower(btrim(old.nome)) || ' - ' || lower(btrim(coalesce(old.uf, ''))),
     lower(btrim(old.nome)) || '/' || lower(btrim(coalesce(old.uf, ''))),
     lower(btrim(old.nome)) || ' ' || lower(btrim(coalesce(old.uf, '')))
   );

  if v_qtd > 0 then
    raise exception
      'O destino "%" está sendo usado em % viagem(ns) e não pode ser excluído.',
      old.nome, v_qtd
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists destinos_bloqueia_exclusao_trg on public.destinos;
create trigger destinos_bloqueia_exclusao_trg
before delete on public.destinos
for each row execute function public.destinos_bloqueia_exclusao_em_uso();

commit;
