import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { normalizePermissions, type PermissionMap } from "@/lib/permissions";

export type Authz = {
  loading: boolean;
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  nome: string | null;
  isAdmin: boolean;
  permissoes: PermissionMap;
};

const initial: Authz = {
  loading: true,
  authenticated: false,
  userId: null,
  email: null,
  nome: null,
  isAdmin: false,
  permissoes: {},
};

let state: Authz = initial;
const listeners = new Set<(s: Authz) => void>();

function emit(next: Authz) {
  state = next;
  listeners.forEach((l) => l(next));
}

/** Recarrega perfil e permissões do banco (RPC me()). */
export async function refreshAuthz(): Promise<Authz> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    emit({ ...initial, loading: false });
    return state;
  }

  const { data, error } = await supabase.rpc("me");
  if (error || !data) {
    emit({
      loading: false,
      authenticated: true,
      userId: user.id,
      email: user.email ?? null,
      nome: (user.user_metadata?.nome as string) ?? null,
      isAdmin: false,
      permissoes: {},
    });
    return state;
  }

  const row = data as Record<string, unknown>;
  emit({
    loading: false,
    authenticated: true,
    userId: user.id,
    email: (row.email as string) ?? user.email ?? null,
    nome: (row.nome as string) ?? null,
    isAdmin: Boolean(row.is_admin),
    permissoes: normalizePermissions(row.permissoes),
  });
  return state;
}

let wired = false;
function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  supabase.auth.onAuthStateChange(() => {
    void refreshAuthz();
  });
  window.addEventListener("focus", () => {
    void refreshAuthz();
  });
}

export function useAuthz() {
  const [snapshot, setSnapshot] = useState<Authz>(state);

  useEffect(() => {
    listeners.add(setSnapshot);
    wire();
    void refreshAuthz();
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);

  const can = useCallback(
    (modulo: string, acao: "view" | "edit" | "delete") => {
      if (snapshot.isAdmin) return true;
      return Boolean(snapshot.permissoes[modulo]?.[acao]);
    },
    [snapshot],
  );

  return { ...snapshot, can, refresh: refreshAuthz };
}
