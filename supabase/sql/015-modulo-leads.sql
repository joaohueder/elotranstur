-- =====================================================================
-- 015 - MÓDULO LEADS
-- Cria o módulo "leads" (listagem completa dos leads do CRM) e libera
-- o acesso às tabelas do CRM também para quem tem permissão em "leads".
-- =====================================================================

-- 1) Políticas: aceitar permissão do módulo 'crm' OU do módulo 'leads'
--    nas tabelas usadas pela tela de leads.

-- crm_leads -----------------------------------------------------------
DROP POLICY IF EXISTS crm_leads_select ON public.crm_leads;
CREATE POLICY crm_leads_select ON public.crm_leads
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_leads_insert ON public.crm_leads;
CREATE POLICY crm_leads_insert ON public.crm_leads
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_leads_update ON public.crm_leads;
CREATE POLICY crm_leads_update ON public.crm_leads
  FOR UPDATE TO authenticated
  USING (is_admin() OR can('crm','edit') OR can('leads','edit'))
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_leads_delete ON public.crm_leads;
CREATE POLICY crm_leads_delete ON public.crm_leads
  FOR DELETE TO authenticated
  USING (is_admin() OR can('crm','delete') OR can('leads','delete'));

-- crm_lead_viagens ----------------------------------------------------
DROP POLICY IF EXISTS crm_lead_viagens_select ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_select ON public.crm_lead_viagens
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_lead_viagens_insert ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_insert ON public.crm_lead_viagens
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_viagens_update ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_update ON public.crm_lead_viagens
  FOR UPDATE TO authenticated
  USING (is_admin() OR can('crm','edit') OR can('leads','edit'))
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_viagens_delete ON public.crm_lead_viagens;
CREATE POLICY crm_lead_viagens_delete ON public.crm_lead_viagens
  FOR DELETE TO authenticated
  USING (is_admin() OR can('crm','delete') OR can('leads','delete'));

-- crm_lead_notas ------------------------------------------------------
DROP POLICY IF EXISTS crm_lead_notas_select ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_select ON public.crm_lead_notas
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_lead_notas_insert ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_insert ON public.crm_lead_notas
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_notas_update ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_update ON public.crm_lead_notas
  FOR UPDATE TO authenticated
  USING (is_admin() OR can('crm','edit') OR can('leads','edit'))
  WITH CHECK (is_admin() OR can('crm','edit') OR can('leads','edit'));

DROP POLICY IF EXISTS crm_lead_notas_delete ON public.crm_lead_notas;
CREATE POLICY crm_lead_notas_delete ON public.crm_lead_notas
  FOR DELETE TO authenticated
  USING (is_admin() OR can('crm','delete') OR can('leads','delete'));

-- crm_stages / crm_origens (leitura para montar filtros e o formulário)
DROP POLICY IF EXISTS crm_stages_select ON public.crm_stages;
CREATE POLICY crm_stages_select ON public.crm_stages
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

DROP POLICY IF EXISTS crm_origens_select ON public.crm_origens;
CREATE POLICY crm_origens_select ON public.crm_origens
  FOR SELECT TO authenticated
  USING (is_admin() OR can('crm','view') OR can('leads','view'));

-- viagens: necessário para listar as viagens de interesse do lead
DROP POLICY IF EXISTS viagens_select ON public.viagens;
CREATE POLICY viagens_select ON public.viagens
  FOR SELECT TO authenticated
  USING (is_admin() OR can('viagens','view') OR can('crm','view') OR can('leads','view'));

-- 2) Cria a linha de permissão do módulo 'leads' para usuários existentes
INSERT INTO public.user_permissions (user_id, modulo, can_view, can_edit, can_delete)
SELECT p.id, 'leads', false, false, false
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up
  WHERE up.user_id = p.id AND up.modulo = 'leads'
);
