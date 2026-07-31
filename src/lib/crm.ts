import { useCallback, useEffect, useState } from "react";

import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import type { Viagem } from "@/lib/viagens";

export type CrmLeadNota = {
  id: string;
  lead_id: string;
  data_hora: string;
  descricao: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmStage = {
  id: string;
  nome: string;
  cor: string;
  posicao: number;
  ativo: boolean;
};

export type CrmLeadViagem = Pick<
  Viagem,
  | "id"
  | "titulo"
  | "subtitulo"
  | "destino"
  | "data_partida"
  | "hora_partida"
  | "valor"
  | "vagas"
  | "itens_inclusos"
  | "imagens"
  | "situacao"
>;

export type CrmLead = {
  id: string;
  nome: string;
  whatsapp: string;
  origem: string;
  stage_id: string | null;
  posicao: number;
  created_at: string;
  viagens: CrmLeadViagem[];
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

const UNIDADES = [
  { limite: 365 * 24 * 60 * 60 * 1000, singular: "ano", plural: "anos", divisor: 365 * 24 * 60 * 60 * 1000 },
  { limite: 30 * 24 * 60 * 60 * 1000, singular: "mês", plural: "meses", divisor: 30 * 24 * 60 * 60 * 1000 },
  { limite: 24 * 60 * 60 * 1000, singular: "dia", plural: "dias", divisor: 24 * 60 * 60 * 1000 },
  { limite: 60 * 60 * 1000, singular: "hora", plural: "horas", divisor: 60 * 60 * 1000 },
  { limite: 60 * 1000, singular: "min", plural: "min", divisor: 60 * 1000 },
];

/** Retorna o tempo de vida do lead em linguagem natural (ex.: "1 dia", "2 meses", "agora"). */
export function tempoDeVida(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  if (diff < 60_000) return "agora";
  for (const u of UNIDADES) {
    if (diff >= u.limite) {
      const valor = Math.floor(diff / u.divisor);
      return `${valor} ${valor === 1 ? u.singular : u.plural}`;
    }
  }
  return "agora";
}

/** Indica se a etapa representa um funil finalizado (fechado ou perdido). */
export function isStageFinal(stage: CrmStage): boolean {
  const nome = stage.nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return nome.includes("fechado") || nome.includes("perdido") || nome.includes("ganho") || nome.includes("convertido");
}

/** Carrega etapas e leads do CRM, incluindo as viagens de interesse. */
export function useCrmData() {
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      const [s, l, v] = await Promise.all([
        supabase
          .from("crm_stages")
          .select("id, nome, cor, posicao, ativo")
          .order("posicao", { ascending: true }),
        supabase
          .from("crm_leads")
          .select("id, nome, whatsapp, origem, stage_id, posicao, created_at")
          .order("posicao", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("crm_lead_viagens")
          .select(
            "lead_id, viagem_id, viagens(id, titulo, subtitulo, destino, data_partida, hora_partida, valor, vagas, itens_inclusos, imagens, situacao)",
          )
          .order("created_at", { ascending: true }),
      ]);
      if (s.error) throw s.error;
      if (l.error) throw l.error;
      if (v.error) throw v.error;

      const viagensPorLead = new Map<string, CrmLeadViagem[]>();
      for (const row of (v.data ?? []) as unknown[]) {
        const r = row as {
          lead_id: string;
          viagens: CrmLeadViagem | CrmLeadViagem[] | null;
        };
        if (!r.viagens) continue;
        const vg = Array.isArray(r.viagens) ? r.viagens[0] : r.viagens;
        if (!vg) continue;
        const lista = viagensPorLead.get(r.lead_id) ?? [];
        lista.push(vg);
        viagensPorLead.set(r.lead_id, lista);
      }

      setStages((s.data ?? []) as CrmStage[]);
      setLeads(
        (l.data ?? []).map((lead) => ({
          ...lead,
          viagens: viagensPorLead.get(lead.id) ?? [],
        })) as CrmLead[],
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(["crm_stages", "crm_leads", "crm_lead_viagens", "viagens"], () =>
    void load(true),
  );

  return { stages, leads, loading, error, reload: load, setLeads };
}

export type CrmOrigem = {
  id: string;
  nome: string;
  posicao: number;
  ativo: boolean;
  /** Origem usada pelo próprio sistema (ex.: Landing Page). Não pode ser editada/excluída. */
  sistema: boolean;
};


/** Carrega as origens de lead configuradas no sistema. */
export function useCrmOrigens(somenteAtivas = false) {
  const [origens, setOrigens] = useState<CrmOrigem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("crm_origens")
        .select("id, nome, posicao, ativo, sistema")
        .order("posicao", { ascending: true });
      if (somenteAtivas) query = query.eq("ativo", true);
      const { data, error: err } = await query;
      if (err) throw err;
      setOrigens((data ?? []) as CrmOrigem[]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [somenteAtivas]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(["crm_origens"], () => void load(true));

  return { origens, loading, error, reload: load };
}
