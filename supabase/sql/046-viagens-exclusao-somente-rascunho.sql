-- 046 - Só permite excluir viagens que estejam com situação "rascunho"

create or replace function public.viagens_bloqueia_exclusao_nao_rascunho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.situacao, '') <> 'rascunho' then
    raise exception 'Somente viagens em Rascunho podem ser excluídas (situação atual: %).', old.situacao
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists viagens_bloqueia_exclusao_nao_rascunho_trg on public.viagens;

create trigger viagens_bloqueia_exclusao_nao_rascunho_trg
before delete on public.viagens
for each row
execute function public.viagens_bloqueia_exclusao_nao_rascunho();
