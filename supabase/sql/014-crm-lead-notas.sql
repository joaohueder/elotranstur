-- Módulo CRM: notas do lead
-- Tabela de histórico/anotações por lead, com data/hora e descrição.

CREATE TABLE IF NOT EXISTS public.crm_lead_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    descricao TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_notas TO authenticated;
GRANT ALL ON public.crm_lead_notas TO service_role;

ALTER TABLE public.crm_lead_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leads notas: usuários veem notas dos leads que podem ver"
ON public.crm_lead_notas
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.crm_leads l
        WHERE l.id = crm_lead_notas.lead_id
          AND public.can('crm', 'view')
    )
);

CREATE POLICY "Leads notas: usuários podem criar notas nos leads que podem editar"
ON public.crm_lead_notas
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.crm_leads l
        WHERE l.id = crm_lead_notas.lead_id
          AND public.can('crm', 'edit')
    )
);

CREATE POLICY "Leads notas: usuários podem editar notas dos leads que podem editar"
ON public.crm_lead_notas
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.crm_leads l
        WHERE l.id = crm_lead_notas.lead_id
          AND public.can('crm', 'edit')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.crm_leads l
        WHERE l.id = crm_lead_notas.lead_id
          AND public.can('crm', 'edit')
    )
);

CREATE POLICY "Leads notas: usuários podem excluir notas dos leads que podem deletar"
ON public.crm_lead_notas
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.crm_leads l
        WHERE l.id = crm_lead_notas.lead_id
          AND public.can('crm', 'delete')
    )
);

CREATE OR REPLACE FUNCTION public.update_crm_lead_notas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_crm_lead_notas_updated_at ON public.crm_lead_notas;
CREATE TRIGGER trg_update_crm_lead_notas_updated_at
BEFORE UPDATE ON public.crm_lead_notas
FOR EACH ROW
EXECUTE FUNCTION public.update_crm_lead_notas_updated_at();
