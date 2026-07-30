import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const MIN_APP_WIDTH = 960;
export const MAX_APP_WIDTH = 2560;
export const DEFAULT_APP_WIDTH = 1440;
const STORAGE_KEY = "elo:layout:max-width";

type LayoutSettings = {
  maxWidth: number;
  setMaxWidth: (value: number) => void;
  resetMaxWidth: () => void;
  isFullWidth: boolean;
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

  // Lê a preferência salva somente no cliente (evita mismatch de hidratação).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    const next = Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_APP_WIDTH;
    setMaxWidthState(next);
    applyToDocument(next);
  }, []);

  const setMaxWidth = useCallback((value: number) => {
    const next = clamp(value);
    setMaxWidthState(next);
    applyToDocument(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const resetMaxWidth = useCallback(() => {
    setMaxWidth(DEFAULT_APP_WIDTH);
  }, [setMaxWidth]);

  const value = useMemo<LayoutSettings>(
    () => ({
      maxWidth,
      setMaxWidth,
      resetMaxWidth,
      isFullWidth: maxWidth >= MAX_APP_WIDTH,
    }),
    [maxWidth, setMaxWidth, resetMaxWidth],
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
