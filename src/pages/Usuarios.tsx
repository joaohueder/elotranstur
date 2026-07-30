import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSeo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import {
  MODULES,
  type AppRole,
  type ManagedUser,
  type PermissionRow,
} from "@/lib/permissions";

type ProfileRow = {
  id: string;
  email: string | null;
  nome: string | null;
  ativo: boolean;
};

export default function UsuariosPage() {
  useSeo({
    title: "Usuários — ELO Transporte e Turismo",
    description:
      "Gestão de usuários do ELO: papéis administrador e usuário, com permissões de visualização, edição e exclusão por módulo.",
  });

  const authz = useAuthz();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (authz.loading || !authz.isAdmin) return;
    let active = true;

    (async () => {
      setLoading(true);
      const [profilesRes, rolesRes, permsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, nome, ativo")
          .order("email"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("user_permissions")
          .select("user_id, modulo, can_view, can_edit, can_delete"),
      ]);
      if (!active) return;

      if (profilesRes.error) {
        toast.error("Não foi possível carregar os usuários.");
        setLoading(false);
        return;
      }

      const roleByUser = new Map<string, AppRole>();
      for (const r of (rolesRes.data ?? []) as {
        user_id: string;
        role: AppRole;
      }[]) {
        if (r.role === "admin") roleByUser.set(r.user_id, "admin");
        else if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, "usuario");
      }

      const permsByUser = new Map<string, Record<string, PermissionRow>>();
      for (const p of (permsRes.data ?? []) as PermissionRow[]) {
        const current = permsByUser.get(p.user_id) ?? {};
        current[p.modulo] = p;
        permsByUser.set(p.user_id, current);
      }

      const list: ManagedUser[] = ((profilesRes.data ?? []) as ProfileRow[]).map(
        (p) => ({
          id: p.id,
          email: p.email,
          nome: p.nome,
          ativo: p.ativo,
          role: roleByUser.get(p.id) ?? "usuario",
          permissions: permsByUser.get(p.id) ?? {},
        }),
      );

      setUsers(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [authz.loading, authz.isAdmin]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  async function changeRole(user: ManagedUser, role: AppRole) {
    const previous = user.role;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role } : u)),
    );

    const del = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id);
    const ins = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role });

    if (del.error || ins.error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: previous } : u)),
      );
      toast.error("Não foi possível alterar o papel deste usuário.");
      return;
    }
    toast.success(
      role === "admin"
        ? "Usuário agora é administrador (acesso total)."
        : "Papel alterado para usuário — defina as permissões.",
    );
  }

  async function togglePermission(
    user: ManagedUser,
    modulo: string,
    field: "can_view" | "can_edit" | "can_delete",
    value: boolean,
  ) {
    const current: PermissionRow = user.permissions[modulo] ?? {
      user_id: user.id,
      modulo,
      can_view: false,
      can_edit: false,
      can_delete: false,
    };

    const next: PermissionRow = { ...current, [field]: value };
    // Editar ou excluir exige visualizar.
    if (value && field !== "can_view") next.can_view = true;
    if (!value && field === "can_view") {
      next.can_edit = false;
      next.can_delete = false;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, permissions: { ...u.permissions, [modulo]: next } }
          : u,
      ),
    );

    const { error } = await supabase
      .from("user_permissions")
      .upsert(next, { onConflict: "user_id,modulo" });

    if (error) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, permissions: { ...u.permissions, [modulo]: current } }
            : u,
        ),
      );
      toast.error("Não foi possível salvar a permissão.");
    }
  }

  if (authz.loading) {
    return (
      <AppShell>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Carregando…
        </p>
      </AppShell>
    );
  }

  if (!authz.isAdmin) {
    return (
      <AppShell>
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              Acesso restrito
            </CardTitle>
            <CardDescription>
              Apenas administradores podem gerenciar usuários e permissões.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Sistema
        </p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">Usuários</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Administradores acessam todos os módulos. Para o papel “usuário”,
          libere individualmente visualização, edição e exclusão por módulo.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Contas</CardTitle>
            <CardDescription>
              {loading ? "Carregando…" : `${users.length} usuário(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 p-0 pb-4">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={[
                  "flex w-full items-center justify-between gap-3 border-l-2 px-6 py-3 text-left transition-colors",
                  u.id === selectedId
                    ? "border-brand-accent bg-muted"
                    : "border-transparent hover:bg-muted/60",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">
                    {u.nome || u.email || u.id}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </span>
                <Badge
                  variant={u.role === "admin" ? "default" : "secondary"}
                  className="rounded-none text-[10px] uppercase tracking-widest"
                >
                  {u.role === "admin" ? "Admin" : "Usuário"}
                </Badge>
              </button>
            ))}
            {!loading && users.length === 0 && (
              <p className="px-6 text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border">
          {selected ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  {selected.role === "admin" ? (
                    <ShieldCheck className="size-5 text-brand-accent" />
                  ) : (
                    <UserIcon className="size-5 text-brand-accent" />
                  )}
                  {selected.nome || selected.email}
                </CardTitle>
                <CardDescription>{selected.email}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-8">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Papel
                  </span>
                  <Select
                    value={selected.role}
                    onValueChange={(v) => changeRole(selected, v as AppRole)}
                    disabled={selected.id === authz.userId}
                  >
                    <SelectTrigger className="w-56 rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="admin">
                        Administrador — acesso total
                      </SelectItem>
                      <SelectItem value="usuario">
                        Usuário — permissões liberadas
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selected.id === authz.userId && (
                    <span className="text-xs text-muted-foreground">
                      Você não pode alterar o seu próprio papel.
                    </span>
                  )}
                </div>

                {selected.role === "admin" ? (
                  <p className="border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                    Administradores têm acesso completo a todos os módulos —
                    não é necessário configurar permissões.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs uppercase tracking-widest">
                          Módulo
                        </TableHead>
                        <TableHead className="w-28 text-center text-xs uppercase tracking-widest">
                          Ver
                        </TableHead>
                        <TableHead className="w-28 text-center text-xs uppercase tracking-widest">
                          Editar
                        </TableHead>
                        <TableHead className="w-28 text-center text-xs uppercase tracking-widest">
                          Excluir
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULES.map((m) => {
                        const p = selected.permissions[m.key];
                        return (
                          <TableRow key={m.key}>
                            <TableCell className="text-sm">{m.label}</TableCell>
                            {(
                              ["can_view", "can_edit", "can_delete"] as const
                            ).map((field) => (
                              <TableCell key={field} className="text-center">
                                <Switch
                                  checked={Boolean(p?.[field])}
                                  onCheckedChange={(v) =>
                                    togglePermission(selected, m.key, field, v)
                                  }
                                  aria-label={`${m.label} — ${field}`}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </>
          ) : (
            <CardHeader>
              <CardTitle className="font-serif text-2xl">
                Selecione um usuário
              </CardTitle>
              <CardDescription>
                Escolha uma conta à esquerda para definir papel e permissões.
              </CardDescription>
            </CardHeader>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
