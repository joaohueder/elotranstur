import { useEffect } from "react";

import {
  SUPABASE_ANON_PUBLIC_KEY,
  SUPABASE_BASE_URL,
  clearRememberMe,
  isRememberMeEnabled,
  supabase,
} from "@/lib/supabase";

/**
 * Encerramento de sessão ao fechar o navegador.
 *
 * Quando o usuário NÃO marcou "Ficar conectado por 30 dias", ao fechar a aba /
 * navegador a sessão é revogada no servidor (logout real), fazendo o usuário
 * aparecer como "não logado" no módulo de usuários.
 */
export function SessionCloseGuard() {
  useEffect(() => {
    let accessToken: string | null = null;

    supabase.auth.getSession().then(({ data }) => {
      accessToken = data.session?.access_token ?? null;
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? null;
    });

    const revoke = () => {
      if (isRememberMeEnabled()) return;
      if (!accessToken) return;

      try {
        // keepalive garante que a requisição saia mesmo com a aba fechando.
        void fetch(`${SUPABASE_BASE_URL}/auth/v1/logout?scope=local`, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: SUPABASE_ANON_PUBLIC_KEY,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
      } catch {
        // Ignora: a aba já está sendo fechada.
      }

      accessToken = null;
      clearRememberMe();
      try {
        window.sessionStorage.clear();
      } catch {
        // ignore
      }
    };

    const onPageHide = (event: PageTransitionEvent) => {
      // persisted = página guardada em cache (voltar/avançar): não desloga.
      if (event.persisted) return;
      revoke();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
