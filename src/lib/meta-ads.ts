import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { supabase } from "@/lib/supabase";

/**
 * Meta Ads · Pixel (browser) + API de Conversões (servidor).
 *
 * Cada evento é enviado nos dois canais com o MESMO `event_id`, para que a
 * Meta faça a deduplicação e não conte o evento duas vezes.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
  }
}

type ConfigMeta = { pixel_id: string; ativo: boolean };

let pixelCarregado = "";
let cfgPromise: Promise<ConfigMeta> | null = null;

async function buscarConfigMeta(): Promise<ConfigMeta> {
  try {
    const { data } = await supabase.rpc("meta_ads_public");
    const d = (data ?? {}) as { pixel_id?: string; ativo?: boolean };
    return { pixel_id: String(d.pixel_id ?? ""), ativo: Boolean(d.ativo) };
  } catch {
    return { pixel_id: "", ativo: false };
  }
}

/** Lê (uma única vez por sessão) o ID do Pixel público. */
export function carregarConfigMeta(): Promise<ConfigMeta> {
  if (!cfgPromise) cfgPromise = buscarConfigMeta();
  return cfgPromise;
}

/** Injeta o script do Pixel apenas uma vez. */
function iniciarPixel(pixelId: string) {
  if (!pixelId || typeof window === "undefined") return;
  if (pixelCarregado === pixelId) return;
  pixelCarregado = pixelId;

  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      // @ts-expect-error assinatura dinâmica do fbq
      n.callMethod ? n.callMethod.apply(n, args) : n.queue!.push(args);
    } as Window["fbq"] & Record<string, unknown>;
    n.queue = [];
    n.loaded = true;
    n.version = "2.0";
    window.fbq = n as Window["fbq"];
    window._fbq = n;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  window.fbq?.("init", pixelId);
}

function lerCookie(nome: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const achado = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nome}=`));
  return achado ? decodeURIComponent(achado.split("=").slice(1).join("=")) : undefined;
}

type DadosUsuario = { nome?: string; whatsapp?: string };

/** Dispara o evento no Pixel e na API de Conversões (deduplicado). */
export async function rastrearMeta(
  eventName: "PageView" | "Lead" | "ViewContent",
  opcoes: { userData?: DadosUsuario; customData?: Record<string, unknown> } = {},
) {
  try {
    const cfg = await carregarConfigMeta();
    if (!cfg.ativo || !cfg.pixel_id) return;

    iniciarPixel(cfg.pixel_id);

    const eventId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());

    window.fbq?.("track", eventName, opcoes.customData ?? {}, { eventID: eventId });

    await supabase.functions.invoke("meta-capi", {
      body: {
        action: "track",
        event_name: eventName,
        event_id: eventId,
        event_source_url:
          typeof window !== "undefined" ? window.location.href : undefined,
        user_data: {
          ...opcoes.userData,
          fbp: lerCookie("_fbp"),
          fbc: lerCookie("_fbc"),
        },
        custom_data: opcoes.customData,
      },
    });
  } catch (err) {
    // Rastreamento nunca pode quebrar a página pública.
    console.warn("Meta Ads: falha ao registrar evento", err);
  }
}

/** Rotas públicas que devem ser rastreadas (login e sistema ficam de fora). */
function ehPaginaPublicaRastreavel(pathname: string) {
  const fora = ["/login", "/verify-code", "/reset-password"];
  if (fora.some((p) => pathname.startsWith(p))) return false;
  return pathname.startsWith("/v/");
}

/** Registra o PageView nas páginas públicas a cada mudança de rota. */
export function MetaPixelTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!ehPaginaPublicaRastreavel(pathname)) return;
    void rastrearMeta("PageView");
  }, [pathname]);

  return null;
}
