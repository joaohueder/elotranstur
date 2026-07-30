import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";

export const MIN_APP_WIDTH = 960;
export const MAX_APP_WIDTH = 2560;
export const DEFAULT_APP_WIDTH = 1440;
/** Cache local apenas para evitar "piscada" antes de carregar do banco. */
const STORAGE_KEY = "elo:layout:max-width";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

type LayoutSettings = {
  maxWidth: number;
  setMaxWidth: (value: number) => void;
  resetMaxWidth: () => void;
  isFullWidth: boolean;
  saveState: SaveState;
};

const LayoutSettingsContext = createContext<LayoutSettings | null>(null);

function clamp(value: number) {
  return Math.min(MAX_APP_WIDTH, Math.max(MIN_APP_WIDTH, Math.round(value)));
}

function applyToDocument(value: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--app-max-width",
    value >= MAX_APP_WIDTH ? "100%" : `${value}px`,
  );
}

export function LayoutSettingsProvider({ children }: { children: ReactNode }) {
  const [maxWidth, setMaxWidthState] = useState<number>(DEFAULT_APP_WIDTH);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Aplica o cache local imediatamente (evita mismatch de hidratação).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    const next = Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_APP_WIDTH;
    setMaxWidthState(next);
    applyToDocument(next);
  }, []);

  // 2) Carrega a preferência do banco (fonte da verdade) e acompanha login/logout.
  useEffect(() => {
    let active = true;

    async function load(userId: string | null) {
      userIdRef.current = userId;
      if (!userId) return;
      setSaveState("loading");
      const { data, error } = await supabase
        .from("user_settings")
        .select("layout_max_width")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setSaveState("error");
        return;
      }
      setSaveState("idle");
      if (data?.layout_max_width != null) {
        const next = clamp(Number(data.layout_max_width));
        setMaxWidthState(next);
        applyToDocument(next);
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
    }

    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        load(session?.user?.id ?? null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const persist = useCallback((value: number) => {
    const userId = userIdRef.current;
    if (!userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { user_id: userId, layout_max_width: value },
          { onConflict: "user_id" },
        );
      setSaveState(error ? "error" : "saved");
    }, 500);
  }, []);

  const setMaxWidth = useCallback(
    (value: number) => {
      const next = clamp(value);
      setMaxWidthState(next);
      applyToDocument(next);
      window.localStorage.setItem(STORAGE_KEY, String(next));
      persist(next);
    },
    [persist],
  );

  const resetMaxWidth = useCallback(() => {
    setMaxWidth(DEFAULT_APP_WIDTH);
  }, [setMaxWidth]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const value = useMemo<LayoutSettings>(
    () => ({
      maxWidth,
      setMaxWidth,
      resetMaxWidth,
      isFullWidth: maxWidth >= MAX_APP_WIDTH,
      saveState,
    }),
    [maxWidth, setMaxWidth, resetMaxWidth, saveState],
  );

  return (
    <LayoutSettingsContext.Provider value={value}>
      {children}
    </LayoutSettingsContext.Provider>
  );
}

export function useLayoutSettings(): LayoutSettings {
  const ctx = useContext(LayoutSettingsContext);
  if (!ctx) {
    throw new Error(
      "useLayoutSettings precisa estar dentro de <LayoutSettingsProvider>.",
    );
  }
  return ctx;
}
