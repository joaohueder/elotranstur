-- ELO — Diagnóstico: "usuários não aparecem na listagem"
-- Execute no SQL Editor da sua instância AUTO-HOSPEDADA, um bloco por vez.

-- 1) Quantas contas existem de fato?
select id, email, created_at from auth.users order by created_at;

-- 2) Os perfis foram criados? (a listagem lê public.profiles, não auth.users)
select * from public.profiles order by email;

-- 3) Papéis existentes
select ur.user_id, u.email, ur.role
from public.user_roles ur
join auth.users u on u.id = ur.user_id
order by u.email;

-- 4) Backfill manual (resolve o caso mais comum: profiles vazio)
insert into public.profiles (id, email, nome)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', u.email)
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'usuario' from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id)
on conflict (user_id, role) do nothing;

-- 5) Garanta que SEU usuário é admin (só admin enxerga a lista completa)
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'joaohueder@gmail.com'
on conflict (user_id, role) do nothing;

-- 6) Recarregue o cache da API
notify pgrst, 'reload schema';
