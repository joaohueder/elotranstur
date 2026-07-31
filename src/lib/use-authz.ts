import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { AppRole, PermissionRow } from "@/lib/permissions";

export type AuthzState = {
  loading: boolean;
  userId: string | null;
  role: AppRole | null;
  permissions: Record<string, PermissionRow>;
};

export type Authz = AuthzState & {
  isAdmin: boolean;
  can: (modulo: string, acao: "view" | "edit" | "delete") => boolean;
  refresh: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Store compartilhado: uma única fonte de verdade para papel + permissões.
// Qualquer componente que use useAuthz() re-renderiza quando o store muda,
// então o menu reflete imediatamente o que foi gravado no banco.
// ---------------------------------------------------------------------------
let state: AuthzState = {
  loading: true,
  userId: null,
  role: null,
  permissions: {},
};

const listeners = new Set<(s: AuthzState) => void>();
let inFlight: Promise<void> | null = null;

function setState(next: Partial<AuthzState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

async function fetchAuthz(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const id = sessionData.session?.user?.id ?? null;

  if (!id) {
    setState({ loading: false, userId: null, role: null, permissions: {} });
    return;
  }

  const [rolesRes, permsRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase
      .from("user_permissions")
      .select("user_id, modulo, can_view, can_edit, can_delete")
      .eq("user_id", id),
  ]);

  let isAdmin = (rolesRes.data ?? []).some(
    (r: { role: string }) => String(r.role).trim() === "admin",
  );

  // Fallback quando a leitura direta é bloqueada por RLS.
  if (!isAdmin && (rolesRes.error || (rolesRes.data ?? []).length === 0)) {
    const rpc = await supabase.rpc("is_admin");
    if (rpc.data === true) isAdmin = true;
  }

  const map: Record<string, PermissionRow> = {};
  for (const p of (permsRes.data ?? []) as PermissionRow[]) map[p.modulo] = p;

  setState({
    loading: false,
    userId: id,
    role: isAdmin ? "admin" : "usuario",
    permissions: map,
  });
}

/** Recarrega papel/permissões do banco e propaga para toda a aplicação. */
export function refreshAuthz(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = fetchAuthz().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

let wired = false;

/** Assina eventos globais uma única vez (auth, foco, realtime, polling). */
function wireGlobalRefresh() {
  if (wired || typeof window === "undefined") return;
  wired = true;

  supabase.auth.onAuthStateChange(() => {
    void refreshAuthz();
  });

  // Volta o foco para a aba → revalida permissões.
  window.addEventListener("focus", () => void refreshAuthz());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshAuthz();
  });

  // Permissões alteradas por um admin em outra sessão.
  supabase
    .channel("authz-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_permissions" },
      () => void refreshAuthz(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_roles" },
      () => void refreshAuthz(),
    )
    .subscribe();

  // Rede de segurança caso o realtime não esteja habilitado na instância.
  window.setInterval(() => {
    if (document.visibilityState === "visible") void refreshAuthz();
  }, 60_000);
}

/** Papel e permissões do usuário logado (validados também por RLS no banco). */
export function useAuthz(): Authz {
  const [snapshot, setSnapshot] = useState<AuthzState>(state);

  useEffect(() => {
    listeners.add(setSnapshot);
    wireGlobalRefresh();
    void refreshAuthz();
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);

  const isAdmin = snapshot.role === "admin";

  return {
    ...snapshot,
    isAdmin,
    refresh: refreshAuthz,
    can: (modulo, acao) => {
      if (isAdmin) return true;
      const p = snapshot.permissions[modulo];
      if (!p) return false;
      if (acao === "view") return p.can_view;
      if (acao === "edit") return p.can_edit;
      return p.can_delete;
    },
  };
}
