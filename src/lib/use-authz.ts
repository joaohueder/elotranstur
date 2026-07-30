import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { AppRole, PermissionRow } from "@/lib/permissions";

export type Authz = {
  loading: boolean;
  userId: string | null;
  role: AppRole | null;
  isAdmin: boolean;
  permissions: Record<string, PermissionRow>;
  can: (modulo: string, acao: "view" | "edit" | "delete") => boolean;
};

/** Papel e permissões do usuário logado (validados também por RLS no banco). */
export function useAuthz(): Authz {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PermissionRow>>(
    {},
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      // Sessão local (não depende de rede) — evita ficar sem papel se o
      // endpoint /auth/v1/user falhar na instância auto-hospedada.
      const { data: sessionData } = await supabase.auth.getSession();
      const id = sessionData.session?.user?.id ?? null;
      if (!active) return;
      setUserId(id);

      if (!id) {
        setRole(null);
        setPermissions({});
        setLoading(false);
        return;
      }

      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", id),
        supabase
          .from("user_permissions")
          .select("user_id, modulo, can_view, can_edit, can_delete")
          .eq("user_id", id),
      ]);
      if (!active) return;

      if (rolesRes.error) {
        console.error("[authz] falha ao ler user_roles:", rolesRes.error);
      }
      if (permsRes.error) {
        console.error(
          "[authz] falha ao ler user_permissions:",
          permsRes.error,
        );
      }

      let isAdmin = (rolesRes.data ?? []).some(
        (r: { role: string }) => String(r.role).trim() === "admin",
      );

      // Fallback: se a leitura direta vier vazia/bloqueada por RLS, pergunta
      // ao banco via função SECURITY DEFINER.
      if (!isAdmin && (rolesRes.error || (rolesRes.data ?? []).length === 0)) {
        const rpc = await supabase.rpc("is_admin");
        if (rpc.error) {
          console.error("[authz] fallback is_admin() falhou:", rpc.error);
        } else if (rpc.data === true) {
          isAdmin = true;
        }
      }

      if (!active) return;
      console.info(
        "[authz] userId:",
        id,
        "papéis:",
        rolesRes.data,
        "admin:",
        isAdmin,
      );
      setRole(isAdmin ? "admin" : "usuario");



      const map: Record<string, PermissionRow> = {};
      for (const p of (permsRes.data ?? []) as PermissionRow[])
        map[p.modulo] = p;
      setPermissions(map);
      setLoading(false);
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        load();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = role === "admin";

  return {
    loading,
    userId,
    role,
    isAdmin,
    permissions,
    can: (modulo, acao) => {
      if (isAdmin) return true;
      const p = permissions[modulo];
      if (!p) return false;
      if (acao === "view") return p.can_view;
      if (acao === "edit") return p.can_edit;
      return p.can_delete;
    },
  };
}
