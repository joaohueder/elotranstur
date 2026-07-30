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

const SUPABASE_URL = readEnv("VITE_SELFHOSTED_SUPABASE_URL");
const SUPABASE_ANON_KEY = readEnv("VITE_SELFHOSTED_SUPABASE_ANON_KEY");

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
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
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
