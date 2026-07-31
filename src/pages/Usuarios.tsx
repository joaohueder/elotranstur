import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  CircleSlash,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Users,
} from "lucide-react";

import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EMPTY_FORM = {
  email: "",
  nome: "",
  senha: "",
  role: "usuario" as AppRole,
};

export default function UsuariosPage() {
  useSeo({
    title: "Usuários — ELO Transporte e Turismo",
    description:
      "Gestão de usuários do ELO: criação de contas, papéis administrador e usuário, com permissões de visualização, edição e exclusão por módulo.",
  });

  const authz = useAuthz();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  type EditDraft = {
    nome: string;
    ativo: boolean;
    role: AppRole;
    permissions: Record<string, PermissionRow>;
  };
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);


  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | AppRole>("todos");
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");


  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    // Fonte principal: RPC de admin que lê direto de auth.users.
    const listRes = await supabase.rpc("admin_list_users");

    const permsByUser = new Map<string, Record<string, PermissionRow>>();

    let list: ManagedUser[] = [];

    if (!listRes.error && Array.isArray(listRes.data)) {
      list = (
        listRes.data as {
          id: string;
          email: string | null;
          nome: string | null;
          ativo: boolean;
          role: AppRole;
          permissions?: Omit<PermissionRow, "user_id">[] | null;
        }[]
      ).map((u) => {
        const perms: Record<string, PermissionRow> = {};
        for (const p of u.permissions ?? []) {
          if (!p?.modulo) continue;
          perms[p.modulo] = {
            user_id: u.id,
            modulo: p.modulo,
            can_view: !!p.can_view,
            can_edit: !!p.can_edit,
            can_delete: !!p.can_delete,
          };
        }
        return {
          id: u.id,
          email: u.email,
          nome: u.nome,
          ativo: u.ativo,
          role: u.role,
          permissions: perms,
        };
      });
    } else {
      // Fallback: tabelas públicas (requer profiles populado).
      setLoadError(
        `Listagem completa indisponível (${listRes.error?.message ?? "RPC ausente"}). Execute supabase/sql/2026_usuarios_admin_list.sql na sua instância.`,
      );

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

      for (const p of (permsRes.data ?? []) as PermissionRow[]) {
        const current = permsByUser.get(p.user_id) ?? {};
        current[p.modulo] = p;
        permsByUser.set(p.user_id, current);
      }

      if (profilesRes.error) {
        setLoadError(
          `Não foi possível carregar os usuários: ${profilesRes.error.message}`,
        );
        toast.error(
          `Não foi possível carregar os usuários: ${profilesRes.error.message}`,
        );
        setLoading(false);
        return;
      }

      const roleByUser = new Map<string, AppRole>();
      for (const r of (rolesRes.data ?? []) as {
        user_id: string;
        role: AppRole;
      }[]) {
        if (r.role === "admin") roleByUser.set(r.user_id, "admin");
        else if (!roleByUser.has(r.user_id))
          roleByUser.set(r.user_id, "usuario");
      }

      list = ((profilesRes.data ?? []) as ProfileRow[]).map((p) => ({
        id: p.id,
        email: p.email,
        nome: p.nome,
        ativo: p.ativo,
        role: roleByUser.get(p.id) ?? "usuario",
        permissions: permsByUser.get(p.id) ?? {},
      }));
    }

    setUsers(list);
    setSelectedId((prev) =>
      prev && list.some((u) => u.id === prev) ? prev : null,
    );
    setLoading(false);
  }, []);


  useEffect(() => {
    if (authz.loading || !authz.can("usuarios", "view")) return;
    void load();
  }, [authz, load]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "todos" && u.role !== roleFilter) return false;
      if (statusFilter === "ativos" && !u.ativo) return false;
      if (statusFilter === "inativos" && u.ativo) return false;
      if (!q) return true;
      return (
        (u.nome ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      ativos: users.filter((u) => u.ativo).length,
      inativos: users.filter((u) => !u.ativo).length,
    }),
    [users],
  );


  // Carrega o rascunho ao abrir a edição de um usuário.
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      nome: selected.nome ?? "",
      ativo: selected.ativo,
      role: selected.role,
      permissions: JSON.parse(
        JSON.stringify(selected.permissions),
      ) as Record<string, PermissionRow>,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);


  async function applyRole(userId: string, role: AppRole) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    return supabase.from("user_roles").insert({ user_id: userId, role });
  }

  async function handleCreate() {
    const email = form.email.trim().toLowerCase();
    const nome = form.nome.trim();
    if (!email || !form.senha) {
      toast.error("Informe e-mail e senha.");
      return;
    }
    if (form.senha.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase.rpc("admin_create_user", {
      _email: email,
      _senha: form.senha,
      _nome: nome || email,
      _role: form.role,
    });

    if (error || !data) {
      setCreating(false);
      toast.error(error?.message ?? "Não foi possível criar o usuário.");
      return;
    }

    const userId = data as string;



    setCreating(false);
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    toast.success("Usuário criado com sucesso.");
    await load();
    setSelectedId(userId);
  }

  async function handleDelete(user: ManagedUser) {
    const { error } = await supabase.rpc("admin_delete_user", {
      _user_id: user.id,
    });
    if (error) {
      toast.error(error.message || "Não foi possível excluir o usuário.");
      return;
    }
    setDeleteTarget(null);
    toast.success("Usuário excluído.");
    setSelectedId(null);
    await load();
  }

  // ——— Edição em rascunho (só grava ao clicar em Salvar) ———
  function setDraftPermission(
    modulo: string,
    field: "can_view" | "can_edit" | "can_delete",
    value: boolean,
  ) {
    setDraft((prev) => {
      if (!prev || !selected) return prev;
      const current: PermissionRow = prev.permissions[modulo] ?? {
        user_id: selected.id,
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
      return { ...prev, permissions: { ...prev.permissions, [modulo]: next } };
    });
  }

  function permissionsChanged(user: ManagedUser, d: EditDraft) {
    return MODULES.some((m) => {
      const a = user.permissions[m.key];
      const b = d.permissions[m.key];
      const norm = (p?: PermissionRow) => [
        Boolean(p?.can_view),
        Boolean(p?.can_edit),
        Boolean(p?.can_delete),
      ];
      return norm(a).join() !== norm(b).join();
    });
  }

  const isDirty = Boolean(
    selected &&
      draft &&
      ((draft.nome.trim() || null) !== (selected.nome ?? null) ||
        draft.ativo !== selected.ativo ||
        draft.role !== selected.role ||
        permissionsChanged(selected, draft)),
  );

  function cancelEdit() {
    setSelectedId(null);
    setDraft(null);
  }

  async function handleSave() {
    if (!selected || !draft) return;
    setSaving(true);

    const nome = draft.nome.trim();

    const permissions = MODULES.map((m) => {
      const p = draft.permissions[m.key];
      return {
        modulo: m.key,
        can_view: p?.can_view ?? false,
        can_edit: p?.can_edit ?? false,
        can_delete: p?.can_delete ?? false,
      };
    });

    const { data, error } = await supabase.rpc("admin_save_user", {
      _user_id: selected.id,
      _nome: nome || null,
      _ativo: draft.ativo,
      _role: draft.role,
      _permissions: permissions,
    });

    if (error) {
      setSaving(false);
      const detalhe = [error.code, error.message, error.details, error.hint]
        .filter(Boolean)
        .join(" — ");
      toast.error(`Não foi possível salvar: ${detalhe}`);
      return;
    }

    const result = (data ?? null) as {
      user_id?: string;
      nome?: string | null;
      ativo?: boolean;
      role?: AppRole;
      permissions?: {
        modulo: string;
        can_view: boolean;
        can_edit: boolean;
        can_delete: boolean;
      }[];
    } | null;

    if (!result || !result.user_id) {
      setSaving(false);
      toast.error(
        "O servidor não confirmou o salvamento. Atualize a função admin_save_user para retornar o estado gravado.",
      );
      await load();
      return;
    }

    if (result.role && result.role !== draft.role) {
      setSaving(false);
      toast.error(
        `O perfil gravado (${result.role}) não corresponde ao selecionado (${draft.role}).`,
      );
      await load();
      return;
    }

    if (draft.role !== "admin") {
      const saved = new Map(
        (result.permissions ?? []).map((p) => [
          p.modulo,
          `${p.can_view}|${p.can_edit}|${p.can_delete}`,
        ]),
      );
      const divergentes = permissions
        .filter(
          (p) =>
            saved.get(p.modulo) !==
            `${p.can_view}|${p.can_edit}|${p.can_delete}`,
        )
        .map((p) => p.modulo);

      if (divergentes.length > 0) {
        setSaving(false);
        toast.error(
          `As permissões não foram gravadas para: ${divergentes.join(", ")}.`,
        );
        await load();
        return;
      }
    }

    // Estado final confirmado pelo servidor.
    const confirmedPermissions: Record<string, PermissionRow> = {};
    for (const p of result.permissions ?? []) {
      confirmedPermissions[p.modulo] = {
        user_id: result.user_id,
        modulo: p.modulo,
        can_view: p.can_view,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      };
    }

    const applyConfirmed = (list: ManagedUser[]) =>
      list.map((u) =>
        u.id === result.user_id
          ? {
              ...u,
              nome: result.nome ?? null,
              ativo: result.ativo ?? u.ativo,
              role: (result.role ?? u.role) as AppRole,
              permissions:
                (result.role ?? u.role) === "admin" ? {} : confirmedPermissions,
            }
          : u,
      );

    setUsers(applyConfirmed);
    setSaving(false);
    toast.success("Alterações salvas.");
    setSelectedId(null);
    setDraft(null);

    // Recarrega e reaplica o estado confirmado (a leitura pode ser filtrada por RLS).
    await load();
    setUsers(applyConfirmed);
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

  if (!authz.can("usuarios", "view")) {
    return (
      <AppShell>
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              Acesso restrito
            </CardTitle>
            <CardDescription>
              Você não tem permissão para visualizar o módulo de usuários.
              Procure o administrador do sistema.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sistema
          </p>
          <h1 className="mt-2 font-serif text-4xl text-foreground">Usuários</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Todos os usuários cadastrados no sistema, com papel, status e
            permissões por módulo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-none"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Atualizar
          </Button>
          <Button
            className="rounded-none"
            onClick={() => {
              setForm(EMPTY_FORM);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            Novo usuário
          </Button>
        </div>
      </header>

      <div className="mb-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: Users },
          { label: "Administradores", value: stats.admins, icon: ShieldCheck },
          { label: "Ativos", value: stats.ativos, icon: CircleCheck },
          { label: "Inativos", value: stats.inativos, icon: CircleSlash },
        ].map((s) => (
          <div key={s.label} className="bg-card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </span>
              <s.icon className="size-4 text-brand-accent" />
            </div>
            <p className="mt-2 font-serif text-3xl text-foreground">
              {loading ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-none pl-9"
            placeholder="Buscar por nome ou e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}
        >
          <SelectTrigger className="w-48 rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="todos">Todos os papéis</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="usuario">Usuários</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-44 rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativos">Somente ativos</SelectItem>
            <SelectItem value="inativos">Somente inativos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {loading
            ? "Carregando…"
            : `${filtered.length} de ${users.length} usuário(s)`}
        </span>
      </div>

      {loadError && (
        <div className="border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}


      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse border border-border bg-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none border-dashed border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              Nenhum usuário encontrado
            </CardTitle>
            <CardDescription>
              Ajuste a busca e os filtros ou crie uma nova conta.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => {
            const initials = (u.nome || u.email || "?")
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((s) => s[0]?.toUpperCase())
              .join("");
            const liberados =
              u.role === "admin"
                ? MODULES.length
                : MODULES.filter((m) => u.permissions[m.key]?.can_view).length;

            return (
              <article
                key={u.id}
                className="group flex flex-col border border-border bg-card transition-colors hover:border-brand-accent"
              >
                <div className="flex items-start gap-3 p-5">
                  <div className="flex size-11 shrink-0 items-center justify-center border border-border bg-muted font-serif text-sm text-foreground">
                    {initials || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.nome || u.email || u.id}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </p>
                  </div>
                  <Badge
                    variant={u.role === "admin" ? "default" : "secondary"}
                    className="rounded-none text-[10px] uppercase tracking-widest"
                  >
                    {u.role === "admin" ? "Admin" : "Usuário"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 border-t border-border px-5 py-3 text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className={[
                        "size-2 rounded-full",
                        u.ativo ? "bg-brand-accent" : "bg-muted-foreground/40",
                      ].join(" ")}
                    />
                    {u.ativo ? "Ativa" : "Desativada"}
                  </span>
                  <span className="text-muted-foreground">
                    {u.role === "admin"
                      ? "Acesso total"
                      : `${liberados}/${MODULES.length} módulos`}
                  </span>
                  {u.id === authz.userId && (
                    <span className="ml-auto uppercase tracking-widest text-brand-accent">
                      você
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-border p-3">
                  <Button
                    variant="secondary"
                    className="flex-1 rounded-none"
                    onClick={() => setSelectedId(u.id)}
                  >
                    <Settings2 className="size-4" />
                    Gerenciar
                  </Button>
                  {u.id !== authz.userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-none text-muted-foreground hover:text-destructive"
                      aria-label={`Excluir ${u.email}`}
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && cancelEdit()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-2xl">
          {selected && draft && (

            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
                  {selected.role === "admin" ? (
                    <ShieldCheck className="size-5 text-brand-accent" />
                  ) : (
                    <UserIcon className="size-5 text-brand-accent" />
                  )}
                  {selected.nome || selected.email}
                </DialogTitle>
                <DialogDescription>{selected.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="nome"
                      className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      Nome
                    </Label>
                    <Input
                      id="nome"
                      className="rounded-none"
                      value={draft.nome}
                      onChange={(e) =>
                        setDraft({ ...draft, nome: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Conta ativa
                    </span>
                    <div className="flex h-10 items-center gap-3">
                      <Switch
                        checked={draft.ativo}
                        disabled={selected.id === authz.userId}
                        onCheckedChange={(v) =>
                          setDraft({ ...draft, ativo: v })
                        }
                        aria-label="Conta ativa"
                      />
                      <span className="text-sm text-muted-foreground">
                        {draft.ativo ? "Ativa" : "Desativada"}
                      </span>
                    </div>
                  </div>

                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Papel
                  </span>
                  <Select
                    value={draft.role}
                    onValueChange={(v) =>
                      setDraft({ ...draft, role: v as AppRole })
                    }
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

                {draft.role === "admin" ? (

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
                        <TableHead className="w-24 text-center text-xs uppercase tracking-widest">
                          Ver
                        </TableHead>
                        <TableHead className="w-24 text-center text-xs uppercase tracking-widest">
                          Editar
                        </TableHead>
                        <TableHead className="w-24 text-center text-xs uppercase tracking-widest">
                          Excluir
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULES.map((m) => {
                        const p = draft.permissions[m.key];
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
                                    setDraftPermission(m.key, field, v)
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
              </div>

              <DialogFooter className="gap-2">
                {selected.id !== authz.userId && (
                  <Button
                    variant="outline"
                    className="mr-auto rounded-none text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 className="size-4" />
                    Excluir conta
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="rounded-none"
                  disabled={saving}
                  onClick={cancelEdit}
                >
                  Cancelar
                </Button>
                <Button
                  className="rounded-none"
                  disabled={saving || !isDirty}
                  onClick={() => void handleSave()}
                >
                  {saving ? "Salvando…" : "Salvar alterações"}
                </Button>
              </DialogFooter>

            </>
          )}
        </DialogContent>
      </Dialog>


      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              Novo usuário
            </DialogTitle>
            <DialogDescription>
              A conta é criada no sistema de autenticação e recebe perfil e
              papel automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="novo-nome">Nome</Label>
              <Input
                id="novo-nome"
                className="rounded-none"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-email">E-mail</Label>
              <Input
                id="novo-email"
                type="email"
                className="rounded-none"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="pessoa@empresa.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Senha provisória</Label>
              <Input
                id="nova-senha"
                type="password"
                className="rounded-none"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
              >
                <SelectTrigger className="rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="usuario">
                    Usuário — permissões liberadas
                  </SelectItem>
                  <SelectItem value="admin">
                    Administrador — acesso total
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-none"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-none"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? "Criando…" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">
              Excluir usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              A conta {deleteTarget?.email} será removida definitivamente,
              junto com papéis e permissões. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
