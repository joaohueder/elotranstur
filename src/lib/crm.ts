import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type CrmStage = {
  id: string;
  nome: string;
  cor: string;
  posicao: number;
  ativo: boolean;
};

export type CrmLead = {
  id: string;
  nome: string;
  whatsapp: string;
  origem: string;
  stage_id: string | null;
  posicao: number;
  created_at: string;
};

export const ORIGENS = [
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Site",
  "Indicação",
  "Telefone",
  "Outros",
] as const;

export function formatWhatsapp(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function whatsappLink(value: string): string {
  const d = value.replace(/\D/g, "");
  return `https://wa.me/55${d}`;
}

/** Carrega etapas e leads do CRM. */
export function useCrmData() {
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([
        supabase
          .from("crm_stages")
          .select("id, nome, cor, posicao, ativo")
          .order("posicao", { ascending: true }),
        supabase
          .from("crm_leads")
          .select("id, nome, whatsapp, origem, stage_id, posicao, created_at")
          .order("posicao", { ascending: true })
          .order("created_at", { ascending: false }),
      ]);
      if (s.error) throw s.error;
      if (l.error) throw l.error;
      setStages((s.data ?? []) as CrmStage[]);
      setLeads((l.data ?? []) as CrmLead[]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { stages, leads, loading, error, reload: load, setLeads };
}
