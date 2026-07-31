import { useCallback, useEffect, useState } from "react";

import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";

export type Destino = {
  id: string;
  nome: string;
  uf: string | null;
  ativo: boolean;
  posicao: number;
};

/** Carrega os destinos cadastrados em Configurações › Destinos. */
export function useDestinos(somenteAtivos = false) {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("destinos")
          .select("id, nome, uf, ativo, posicao")
          .order("posicao", { ascending: true })
          .order("nome", { ascending: true });
        if (somenteAtivos) query = query.eq("ativo", true);
        const { data, error: err } = await query;
        if (err) throw err;
        setDestinos((data ?? []) as Destino[]);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [somenteAtivos],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(["destinos"], () => void load(true));

  return { destinos, loading, error, reload: load };
}

/** Nome completo do destino, com UF quando informada. */
export function nomeDestino(d: Pick<Destino, "nome" | "uf">): string {
  return d.uf ? `${d.nome} - ${d.uf}` : d.nome;
}
