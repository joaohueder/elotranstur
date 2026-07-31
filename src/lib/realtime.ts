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
    let poll: ReturnType<typeof setInterval> | null = null;
    let conectado = false;

    const disparar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handler.current(), 250);
    };

    const iniciarPolling = () => {
      if (poll) return;
      // Fallback: se o Realtime não conectar (ou cair), atualiza periodicamente.
      poll = setInterval(() => handler.current(), 10000);
    };

    const pararPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };

    const channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of lista) {
      (channel as unknown as {
        on: (t: string, f: Record<string, string>, cb: () => void) => void;
      }).on("postgres_changes", { event: "*", schema: "public", table }, disparar);
    }
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        conectado = true;
        pararPolling();
        disparar();
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        conectado = false;
        iniciarPolling();
      }
    });

    // Se em 5s o canal não conectou, liga o fallback.
    const guarda = setTimeout(() => {
      if (!conectado) iniciarPolling();
    }, 5000);

    // Atualiza ao voltar para a aba/janela.
    const aoFocar = () => {
      if (document.visibilityState === "visible") disparar();
    };
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener("focus", aoFocar);

    return () => {
      clearTimeout(guarda);
      if (timer) clearTimeout(timer);
      pararPolling();
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener("focus", aoFocar);
      void supabase.removeChannel(channel);
    };
  }, [key, enabled]);
}

