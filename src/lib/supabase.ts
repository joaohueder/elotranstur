import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase do ELO Transporte e Turismo.
 *
 * REGRA OBRIGATÓRIA DO PROJETO: este sistema usa EXCLUSIVAMENTE a instância
 * Supabase AUTO-HOSPEDADA do usuário. Nenhum código da aplicação deve importar
 * `@/integrations/supabase/*` (Supabase gerenciado / Lovable Cloud).
 *
 * Configure as variáveis de ambiente:
 *   VITE_SELFHOSTED_SUPABASE_URL       ex.: https://supabase.suaempresa.com.br
 *   VITE_SELFHOSTED_SUPABASE_ANON_KEY  anon key da sua instância
 */

function readEnv(name: string): string | undefined {
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  if (fromVite) return fromVite;
  if (typeof process !== "undefined" && process.env) {
    return process.env[name] ?? process.env[name.replace(/^VITE_/, "")];
  }
  return undefined;
}

// Valores padrão da instância auto-hospedada do ELO (URL e anon key são públicas).
const DEFAULT_URL = "https://supabase.vps10409.panel.icontainer.cloud";
const DEFAULT_ANON_KEY =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3ODU0NDkzNjgsImV4cCI6MjEwMDgwOTM2OCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.JJMSkX2HUdP9u1m-2MrOAfOCur5XR5slGLluqT3gwfk";

const SUPABASE_URL = readEnv("VITE_SELFHOSTED_SUPABASE_URL") ?? DEFAULT_URL;
const SUPABASE_ANON_KEY = readEnv("VITE_SELFHOSTED_SUPABASE_ANON_KEY") ?? DEFAULT_ANON_KEY;


/**
 * Persistência de sessão "Manter conectado".
 *
 * - Checado: a sessão fica em localStorage e vale por 30 dias (sem novo login).
 * - Não checado: a sessão fica apenas em sessionStorage (some ao fechar a aba).
 */
export const REMEMBER_ME_KEY = "elo.auth.remember";
const REMEMBER_EXPIRES_KEY = "elo.auth.remember_expires_at";
export const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_MS = REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;

function rememberEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(REMEMBER_ME_KEY) === "true";
}

function rememberExpired(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(REMEMBER_EXPIRES_KEY);
  if (!raw) return false;
  const expiresAt = Number(raw);
  return Number.isFinite(expiresAt) && Date.now() > expiresAt;
}

/** Define se a sessão atual deve durar 30 dias (checkbox "Manter conectado"). */
export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(REMEMBER_ME_KEY, "true");
    window.localStorage.setItem(
      REMEMBER_EXPIRES_KEY,
      String(Date.now() + REMEMBER_ME_MS),
    );
  } else {
    window.localStorage.removeItem(REMEMBER_ME_KEY);
    window.localStorage.removeItem(REMEMBER_EXPIRES_KEY);
  }
}

/** Limpa os marcadores de persistência (usar no logout). */
export function clearRememberMe() {
  setRememberMe(false);
}

const persistentAuthStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    if (rememberEnabled()) {
      if (rememberExpired()) {
        // Passou dos 30 dias: exige novo login.
        window.localStorage.removeItem(key);
        clearRememberMe();
        return null;
      }
      return window.localStorage.getItem(key);
    }
    return (
      window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
    );
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    if (rememberEnabled()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

function createSelfHostedClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["VITE_SELFHOSTED_SUPABASE_URL"] : []),
      ...(!SUPABASE_ANON_KEY ? ["VITE_SELFHOSTED_SUPABASE_ANON_KEY"] : []),
    ].join(", ");
    throw new Error(
      `Supabase auto-hospedado não configurado. Variável(is) ausente(s): ${missing}.`,
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? persistentAuthStorage : undefined,
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: typeof window !== "undefined",
    },
  });
}

let _client: SupabaseClient | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!_client) _client = createSelfHostedClient();
    return Reflect.get(_client, prop, receiver);
  },
});
