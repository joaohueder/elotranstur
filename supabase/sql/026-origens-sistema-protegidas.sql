-- =====================================================================
-- 026 - Origens de lead usadas pelo sistema (protegidas)
-- Banco: Supabase auto-hospedado · idempotente
-- =====================================================================

begin;

alter table public.crm_origens
  add column if not exists sistema boolean not null default false;

-- Origens criadas/usadas pelo próprio sistema
update public.crm_origens
   set sistema = true, ativo = true
 where nome in ('Landing Page');

-- Bloqueia edição (nome/ativo/sistema) das origens de sistema.
-- A posição continua livre para permitir reordenar a lista.
create or replace function public.crm_origens_protege_sistema()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'DELETE' then
    if old.sistema then
      raise exception 'A origem "%" é usada pelo sistema e não pode ser excluída.', old.nome
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.sistema then
    if new.nome is distinct from old.nome
       or new.ativo is distinct from old.ativo
       or new.sistema is distinct from old.sistema then
      raise exception 'A origem "%" é usada pelo sistema e não pode ser alterada.', old.nome
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_origens_protege_sistema_trg on public.crm_origens;
create trigger crm_origens_protege_sistema_trg
before update or delete on public.crm_origens
for each row execute function public.crm_origens_protege_sistema();

-- Garante que a origem da landing page exista e esteja marcada
insert into public.crm_origens (nome, ativo, sistema, posicao)
select 'Landing Page', true, true,
       coalesce((select max(posicao) + 1 from public.crm_origens), 0)
where not exists (select 1 from public.crm_origens where nome = 'Landing Page');

notify pgrst, 'reload schema';

commit;
