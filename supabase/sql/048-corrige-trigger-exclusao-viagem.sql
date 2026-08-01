-- 048 - Corrige erro 22P02 (enum viagem_situacao) na trigger de exclusão de viagens
-- O coalesce(old.situacao, '') tentava converter '' para o enum. Trocado por "is distinct from".

create or replace function public.viagens_bloqueia_exclusao_nao_rascunho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.situacao is distinct from 'rascunho'::viagem_situacao then
    raise exception 'Somente viagens em Rascunho podem ser excluídas (situação atual: %).', coalesce(old.situacao::text, 'indefinida')
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
