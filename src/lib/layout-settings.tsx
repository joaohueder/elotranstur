import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";

export const MIN_MAX_WIDTH = 960;
export const MAX_MAX_WIDTH = 1920;
export const DEFAULT_MAX_WIDTH = 1280;
const STORAGE_KEY = "elo:layout-max-width";

type LayoutSettingsValue = {
  maxWidth: number;
  loading: boolean;
  /** Persiste no banco e aplica imediatamente ao sistema. */
  save: (value: number) => Promise<void>;
};

const LayoutSettingsContext = createContext<LayoutSettingsValue>({
  maxWidth: DEFAULT_MAX_WIDTH,
  loading: false,
  save: async () => {},
});

function clamp(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_WIDTH;
  return Math.min(MAX_MAX_WIDTH, Math.max(MIN_MAX_WIDTH, Math.round(value)));
}

function applyToDocument(value: number) {
  document.documentElement.style.setProperty("--app-max-width", `${value}px`);
}

function readCache() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? clamp(Number(raw)) : DEFAULT_MAX_WIDTH;
}

export function LayoutSettingsProvider({ children }: { children: ReactNode }) {
  const [maxWidth, setMaxWidth] = useState<number>(() => {
    const initial = typeof window === "undefined" ? DEFAULT_MAX_WIDTH : readCache();
    if (typeof window !== "undefined") applyToDocument(initial);
    return initial;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (!cancelado) setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_my_settings");
      if (cancelado) return;

      if (!error && data && typeof data === "object") {
        const value = clamp(
          Number((data as { layout_max_width?: number }).layout_max_width),
        );
        setMaxWidth(value);
        applyToDocument(value);
        window.localStorage.setItem(STORAGE_KEY, String(value));
      }
      setLoading(false);
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  useRealtime(["user_settings"], () => {
    void (async () => {
      const { data } = await supabase.rpc("get_my_settings");
      if (data && typeof data === "object") {
        const value = clamp(
          Number((data as { layout_max_width?: number }).layout_max_width),
        );
        setMaxWidth(value);
        applyToDocument(value);
        window.localStorage.setItem(STORAGE_KEY, String(value));
      }
    })();
  });

  const save = useCallback(async (value: number) => {
    const alvo = clamp(value);
    const { error } = await supabase.rpc("save_my_settings", {
      _layout_max_width: alvo,
    });
    if (error) throw error;

    setMaxWidth(alvo);
    applyToDocument(alvo);
    window.localStorage.setItem(STORAGE_KEY, String(alvo));
  }, []);

  const value = useMemo(
    () => ({ maxWidth, loading, save }),
    [maxWidth, loading, save],
  );

  return (
    <LayoutSettingsContext.Provider value={value}>
      {children}
    </LayoutSettingsContext.Provider>
  );
}

export function useLayoutSettings() {
  return useContext(LayoutSettingsContext);
}
