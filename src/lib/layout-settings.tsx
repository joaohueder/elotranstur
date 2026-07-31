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
const SEO_STORAGE_KEY = "elo:seo-settings";

export type SeoSettings = {
  siteName: string;
  title: string;
  description: string;
  imageUrl: string;
};

export const DEFAULT_SEO: SeoSettings = {
  siteName: "ELO Transporte e Turismo",
  title: "ELO Transporte e Turismo",
  description:
    "Viagens, excursões e experiências de turismo com a ELO Transporte e Turismo.",
  imageUrl: "",
};

type LayoutSettingsValue = {
  maxWidth: number;
  seo: SeoSettings;
  loading: boolean;
  /** Persiste no banco e aplica imediatamente ao sistema. */
  save: (value: number, seo?: SeoSettings) => Promise<void>;
};

const LayoutSettingsContext = createContext<LayoutSettingsValue>({
  maxWidth: DEFAULT_MAX_WIDTH,
  seo: DEFAULT_SEO,
  loading: false,
  save: async () => {},
});

function readSeoCache(): SeoSettings {
  try {
    const raw = window.localStorage.getItem(SEO_STORAGE_KEY);
    return raw ? { ...DEFAULT_SEO, ...(JSON.parse(raw) as SeoSettings) } : DEFAULT_SEO;
  } catch {
    return DEFAULT_SEO;
  }
}

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
  const [seo, setSeo] = useState<SeoSettings>(() =>
    typeof window === "undefined" ? DEFAULT_SEO : readSeoCache(),
  );
  const [loading, setLoading] = useState(true);

  const aplicar = useCallback((raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const value = clamp(Number((raw as { layout_max_width?: number }).layout_max_width));
    setMaxWidth(value);
    applyToDocument(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));

    const r = raw as Record<string, unknown>;
    const proximo: SeoSettings = {
      siteName: String(r.seo_site_name ?? DEFAULT_SEO.siteName),
      title: String(r.seo_title ?? DEFAULT_SEO.title),
      description: String(r.seo_description ?? DEFAULT_SEO.description),
      imageUrl: String(r.seo_image_url ?? "" ?? ""),
    };
    setSeo(proximo);
    window.localStorage.setItem(SEO_STORAGE_KEY, JSON.stringify(proximo));
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      // Configuração global: vale também para páginas públicas (sem login).
      const { data, error } = await supabase.rpc("get_layout_settings");
      if (cancelado) return;
      if (!error) aplicar(data);
      setLoading(false);
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [aplicar]);

  useRealtime(["app_layout_settings"], () => {
    void (async () => {
      const { data } = await supabase.rpc("get_layout_settings");
      aplicar(data);
    })();
  });

  const save = useCallback(async (value: number, novoSeo?: SeoSettings) => {
    const alvo = clamp(value);
    const s = novoSeo ?? seo;
    const { error } = await supabase.rpc("save_layout_settings", {
      _layout_max_width: alvo,
      _seo_site_name: s.siteName,
      _seo_title: s.title,
      _seo_description: s.description,
      _seo_image_url: s.imageUrl || null,
    });
    if (error) throw error;

    setMaxWidth(alvo);
    applyToDocument(alvo);
    window.localStorage.setItem(STORAGE_KEY, String(alvo));
    setSeo(s);
    window.localStorage.setItem(SEO_STORAGE_KEY, JSON.stringify(s));
  }, [seo]);


  const value = useMemo(
    () => ({ maxWidth, seo, loading, save }),
    [maxWidth, seo, loading, save],
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
