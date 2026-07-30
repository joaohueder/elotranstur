import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./supabase";

/**
 * Anexa o bearer token da sessão da instância Supabase AUTO-HOSPEDADA
 * às chamadas de server functions. Substitui o attacher gerado pelo
 * Supabase gerenciado (Lovable Cloud), que não é usado neste projeto.
 */
export const attachSelfHostedSupabaseAuth = createMiddleware({
  type: "function",
}).client(async ({ next }) => {
  let headers: Record<string, string> | undefined;

  if (typeof window !== "undefined") {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers = { Authorization: `Bearer ${token}` };
    } catch {
      // sem sessão: segue sem header
    }
  }

  return next(headers ? { headers } : undefined);
});
