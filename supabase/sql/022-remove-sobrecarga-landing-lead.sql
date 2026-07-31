-- =====================================================================
-- 022 - Remove função antiga de lead com campo mensagem
-- Banco: Supabase auto-hospedado
-- Executar após 021. Idempotente: pode rodar quantas vezes precisar.
-- =====================================================================

begin;

-- O PostgREST não consegue escolher a função correta enquanto coexistirem
-- as versões de 3 e 4 parâmetros. A versão atual aceita somente:
-- slug, nome e WhatsApp.
drop function if exists public.landing_lead(text, text, text, text);

grant execute on function public.landing_lead(text, text, text)
  to anon, authenticated;

-- Solicita a atualização imediata do cache de funções da API REST.
notify pgrst, 'reload schema';

commit;