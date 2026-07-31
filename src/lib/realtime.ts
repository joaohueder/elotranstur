import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Assina alterações em tempo real (INSERT/UPDATE/DELETE) das tabelas informadas
 * e dispara o callback (com debounce) sempre que algo mudar no banco.
 *
 * Uso: useRealtime(["crm_leads", "crm_stages"], () => reload(true));
 */
export function useRealtime(
  tables: string[],
  onChange: () => void,
  enabled = true,
) {
  const handler = useRef(onChange);
  handler.current = onChange;

  const key = tables.join(",");

  useEffect(() => {
    if (!enabled || !key) return;
    const lista = key.split(",");
    let timer: ReturnType<typeof setTimeout> | null = null;

    const disparar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handler.current(), 250);
    };

    const channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of lista) {
      (channel as unknown as {
        on: (t: string, f: Record<string, string>, cb: () => void) => void;
      }).on("postgres_changes", { event: "*", schema: "public", table }, disparar);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [key, enabled]);
}
