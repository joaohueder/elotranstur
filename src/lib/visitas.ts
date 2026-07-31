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
      const { error } = await supabase.rpc("registrar_visita", {
        _visitor: id,
        _path: pathname,
        _referrer: document.referrer || null,
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
