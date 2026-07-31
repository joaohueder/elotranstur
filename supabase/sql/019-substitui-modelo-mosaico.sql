-- =====================================================================
-- 019 - Substitui o modelo de landing page "Mosaico" por "Horizonte"
-- Banco: Supabase auto-hospedado
-- Executar após 018.
-- =====================================================================

begin;

-- 1) Migra viagens que usavam o modelo removido -------------------------
update public.viagens
set landing_modelo = 'horizonte'
where landing_modelo = 'mosaico';

-- 2) Garante que modelos inexistentes voltem ao padrão ------------------
update public.viagens
set landing_modelo = 'aurora'
where landing_modelo not in (
  'aurora','impacto','diagonal','editorial','cartaz','bilhete','flutuante',
  'sereno','horizonte','expresso','convite','holofote','camadas','stories','painel'
);

commit;
