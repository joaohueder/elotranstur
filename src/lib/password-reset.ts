import { supabase } from "@/lib/supabase";

/**
 * Chama a Edge Function password-reset, que envia o código pelo SMTP do
 * sistema (Configurações > E-mail) e valida o fluxo de troca de senha.
 * Extrai a mensagem real de erro retornada pela função.
 */
async function chamar<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("password-reset", {
    body: payload,
  });

  if (error) {
    let detalhe = error.message;
    const resposta = (error as { context?: Response }).context;
    if (resposta && typeof resposta.text === "function") {
      try {
        const texto = await resposta.clone().text();
        try {
          const corpo = JSON.parse(texto);
          detalhe = corpo.error ?? corpo.message ?? texto;
        } catch {
          detalhe = texto || detalhe;
        }
      } catch {
        /* mantém a mensagem original */
      }
    }
    throw new Error(detalhe);
  }

  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: unknown }).error));
  }

  return data as T;
}

export function solicitarCodigoSenha(email: string) {
  return chamar<{ ok: true }>({ action: "request", email });
}

export function verificarCodigoSenha(email: string, code: string) {
  return chamar<{ ok: true; token: string }>({ action: "verify", email, code });
}

export function redefinirSenhaComToken(token: string, password: string) {
  return chamar<{ ok: true }>({ action: "reset", token, password });
}

const TOKEN_KEY = "elo.reset-token";

export const resetTokenStore = {
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  get: () => sessionStorage.getItem(TOKEN_KEY),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};
