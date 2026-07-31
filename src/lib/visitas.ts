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

/** Dados de geolocalização aproximada (por IP), buscados uma vez por sessão. */
let geoCache: Record<string, string> | null = null;
async function geo(): Promise<Record<string, string>> {
  if (geoCache) return geoCache;
  try {
    const cache = sessionStorage.getItem("elo:geo");
    if (cache) {
      geoCache = JSON.parse(cache);
      return geoCache!;
    }
  } catch {
    /* ignora */
  }
  try {
    const r = await fetch("https://ipapi.co/json/");
    const j = (await r.json()) as Record<string, unknown>;
    geoCache = {
      ip: String(j.ip ?? ""),
      cidade: String(j.city ?? ""),
      regiao: String(j.region ?? ""),
      pais: [j.country_name, j.country_code].filter(Boolean).join(" / "),
      provedor: String(j.org ?? ""),
    };
    try {
      sessionStorage.setItem("elo:geo", JSON.stringify(geoCache));
    } catch {
      /* ignora */
    }
  } catch {
    geoCache = {};
  }
  return geoCache;
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
async function detalhesDaVisita(pathname: string) {
  const { ua, navegador, sistema, dispositivo } = ambiente();
  const params = new URLSearchParams(window.location.search);
  const g = await geo();
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

    const registrar = async () => {
      if (document.visibilityState !== "visible") return;
      const dados = await detalhesDaVisita(pathname);
      const { error } = await supabase.rpc("registrar_visita", {
        _visitor: id,
        _path: pathname,
        _referrer: document.referrer || null,
        _dados: dados,
      });
      if (error) console.warn("registrar_visita", error.message);
    };

    void registrar();
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
