import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { supabase } from "@/lib/supabase";

const CHAVE_VISITANTE = "elo:visitor-id";

/** Identificador anônimo e persistente do visitante (não contém dados pessoais). */
function visitorId(): string {
  try {
    let id = localStorage.getItem(CHAVE_VISITANTE);
    if (!id) {
      id = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(CHAVE_VISITANTE, id);
    }
    return id;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

/** Rotas públicas contabilizadas no Dashboard (login fica de fora). */
const ROTAS_PUBLICAS = ["/v/", "/verificar-codigo", "/reset-password"];

/** Páginas públicas cujas visitas são contabilizadas no Dashboard. */
function ehPaginaPublica(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  return ROTAS_PUBLICAS.some(
    (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
  );
}

/** Dados de geolocalização aproximada (por IP), com múltiplos provedores. */
type Geo = {
  ip?: string;
  cidade?: string;
  regiao?: string;
  pais?: string;
  provedor?: string;
};

const CHAVE_GEO = "elo:geo";
let geoCache: Geo | null = null;
let geoPendente: Promise<Geo> | null = null;

function geoValida(g: Geo | null | undefined): g is Geo {
  return !!g && (!!g.cidade || !!g.ip);
}

function lerGeoCache(): Geo | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_GEO);
    if (!bruto) return null;
    const g = JSON.parse(bruto) as Geo;
    return geoValida(g) ? g : null;
  } catch {
    return null;
  }
}

async function buscarJson(url: string, ms = 4000): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Provedores públicos de geolocalização por IP, tentados em ordem. */
const PROVEDORES: Array<() => Promise<Geo | null>> = [
  async () => {
    const j = await buscarJson("https://ipwho.is/");
    if (!j || j.success === false) return null;
    const conn = (j.connection ?? {}) as Record<string, unknown>;
    return {
      ip: txt(j.ip),
      cidade: txt(j.city),
      regiao: txt(j.region),
      pais: [txt(j.country), txt(j.country_code)].filter(Boolean).join(" / "),
      provedor: txt(conn.isp) || txt(conn.org),
    };
  },
  async () => {
    const j = await buscarJson("https://ipapi.co/json/");
    if (!j || j.error) return null;
    return {
      ip: txt(j.ip),
      cidade: txt(j.city),
      regiao: txt(j.region),
      pais: [txt(j.country_name), txt(j.country_code)].filter(Boolean).join(" / "),
      provedor: txt(j.org),
    };
  },
  async () => {
    const j = await buscarJson("https://freeipapi.com/api/json");
    if (!j) return null;
    return {
      ip: txt(j.ipAddress),
      cidade: txt(j.cityName),
      regiao: txt(j.regionName),
      pais: [txt(j.countryName), txt(j.countryCode)].filter(Boolean).join(" / "),
      provedor: "",
    };
  },
  async () => {
    const j = await buscarJson("https://get.geojs.io/v1/ip/geo.json");
    if (!j) return null;
    return {
      ip: txt(j.ip),
      cidade: txt(j.city),
      regiao: txt(j.region),
      pais: [txt(j.country), txt(j.country_code)].filter(Boolean).join(" / "),
      provedor: txt(j.organization_name),
    };
  },
];

async function geo(): Promise<Geo> {
  if (geoValida(geoCache)) return geoCache;
  const cache = lerGeoCache();
  if (cache) {
    geoCache = cache;
    return cache;
  }
  if (geoPendente) return geoPendente;

  geoPendente = (async () => {
    for (const buscar of PROVEDORES) {
      const g = await buscar().catch(() => null);
      if (geoValida(g)) {
        const limpo: Geo = {
          ip: g.ip || "",
          cidade: g.cidade || "",
          regiao: g.regiao || "",
          pais: g.pais || "",
          provedor: g.provedor || "",
        };
        geoCache = limpo;
        try {
          sessionStorage.setItem(CHAVE_GEO, JSON.stringify(limpo));
        } catch {
          /* ignora */
        }
        return limpo;
      }
    }
    return {} as Geo;
  })();

  const resultado = await geoPendente;
  geoPendente = null;
  return resultado;
}

/** Navegador, sistema e tipo de dispositivo a partir do user agent. */
function ambiente() {
  const ua = navigator.userAgent;
  const navegador =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Outro";
  const sistema =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Outro";
  const dispositivo = /iPad|Tablet/.test(ua)
    ? "Tablet"
    : /Mobi|Android|iPhone/.test(ua)
      ? "Celular"
      : "Computador";
  return { ua, navegador, sistema, dispositivo };
}

/** Monta o pacote de detalhes registrado junto com a visita. */
async function detalhesDaVisita(pathname: string, esperarGeo = true) {
  const { ua, navegador, sistema, dispositivo } = ambiente();
  const params = new URLSearchParams(window.location.search);
  const g = esperarGeo ? await geo() : (geoCache ?? lerGeoCache() ?? {});
  return {
    ...g,
    user_agent: ua,
    navegador,
    sistema,
    dispositivo,
    idioma: navigator.language,
    resolucao: `${window.screen.width}x${window.screen.height}`,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
    query: window.location.search || "",
    url: `${window.location.origin}${pathname}${window.location.search}`,
    titulo: document.title,
    utm_source: params.get("utm_source") ?? "",
    utm_medium: params.get("utm_medium") ?? "",
    utm_campaign: params.get("utm_campaign") ?? "",
    utm_term: params.get("utm_term") ?? "",
    utm_content: params.get("utm_content") ?? "",
    fbclid: params.get("fbclid") ?? "",
    gclid: params.get("gclid") ?? "",
  };
}

/** Marca a visita atual como convertida em lead. */
export async function marcarVisitaLead(whatsapp?: string) {
  try {
    await supabase.rpc("marcar_visita_lead", {
      _visitor: visitorId(),
      _whatsapp: whatsapp ?? null,
    });
  } catch {
    /* não bloqueia o envio do lead */
  }
}

/**
 * Registra visitas das páginas públicas e mantém um "heartbeat" a cada
 * 60 segundos, permitindo medir quem está online nos últimos 3 minutos.
 */
export function VisitTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!ehPaginaPublica(pathname)) return;
    const id = visitorId();

    const registrar = async (esperarGeo = true) => {
      if (document.visibilityState !== "visible") return;
      const dados = await detalhesDaVisita(pathname, esperarGeo);
      const { error } = await supabase.rpc("registrar_visita", {
        _visitor: id,
        _path: pathname,
        _referrer: document.referrer || null,
        _dados: dados,
      });
      if (error) console.warn("registrar_visita", error.message);
    };

    // 1ª chamada imediata (sem esperar a geolocalização) e, em seguida,
    // uma nova chamada já com cidade/IP para completar o registro.
    void registrar(false).then(() => registrar(true));
    const timer = setInterval(() => void registrar(), 60_000);
    const aoVoltar = () => void registrar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [pathname]);

  return null;
}


export type VisitasDia = { dia: string; unica: number; total: number };

export type VisitasMetricas = {
  online: number;
  dia_unica: number;
  dia_total: number;
  mes_unica: number;
  mes_total: number;
  semana: VisitasDia[];
};

const VAZIO: VisitasMetricas = {
  online: 0,
  dia_unica: 0,
  dia_total: 0,
  mes_unica: 0,
  mes_total: 0,
  semana: [],
};

/** Métricas de visitas do Dashboard, atualizadas automaticamente a cada 30s. */
export function useVisitas() {
  const [dados, setDados] = useState<VisitasMetricas>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc("dashboard_visitas");
      if (err) throw err;
      setDados({ ...VAZIO, ...((data ?? {}) as Partial<VisitasMetricas>) });
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { visitas: dados, loading, error, reload: load };
}

export type VisitaDetalhada = {
  id: string;
  visitor_id: string;
  created_at: string;
  updated_at?: string | null;
  path: string;
  referrer?: string | null;
  ip?: string | null;
  cidade?: string | null;
  regiao?: string | null;
  pais?: string | null;
  provedor?: string | null;
  user_agent?: string | null;
  dispositivo?: string | null;
  navegador?: string | null;
  sistema?: string | null;
  idioma?: string | null;
  resolucao?: string | null;
  fuso?: string | null;
  query?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  virou_lead?: boolean | null;
  lead_id?: string | null;
  lead_nome?: string | null;
  lead_whatsapp?: string | null;
  lead_origem?: string | null;
  lead_etapa?: string | null;
  detalhes?: Record<string, unknown> | null;
};

/** Últimas visitas registradas, atualizadas a cada 30 segundos. */
export function useUltimasVisitas(limite = 10) {
  const [visitas, setVisitas] = useState<VisitaDetalhada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      try {
        const { data, error: err } = await supabase.rpc(
          "dashboard_ultimas_visitas",
          { _limite: limite },
        );
        if (err) throw err;
        setVisitas((data ?? []) as VisitaDetalhada[]);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [limite],
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return { visitas, loading, error, reload: load };
}
