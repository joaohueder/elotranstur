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
import { createSignupClient, supabase } from "@/lib/supabase";
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

  const [nomeDraft, setNomeDraft] = useState("");
  const [savingNome, setSavingNome] = useState(false);
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

    // Garante que contas recém-criadas em auth.users tenham perfil/papel.
    const syncRes = await supabase.rpc("admin_sync_profiles");
    if (syncRes.error) {
      console.warn("[usuarios] admin_sync_profiles:", syncRes.error.message);
      setLoadError(
        `Sincronização de perfis falhou: ${syncRes.error.message}. Execute o SQL supabase/sql/2026_usuarios_sync_profiles.sql na sua instância.`,
      );
    }

    const [profilesRes, rolesRes, permsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, nome, ativo").order("email"),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("user_permissions")
        .select("user_id, modulo, can_view, can_edit, can_delete"),
    ]);

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
    setSelectedId((prev) =>
      prev && list.some((u) => u.id === prev) ? prev : null,
    );
    setLoading(false);

  }, []);

  useEffect(() => {
    if (authz.loading || !authz.isAdmin) return;
    void load();
  }, [authz.loading, authz.isAdmin, load]);

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


  useEffect(() => {
    setNomeDraft(selected?.nome ?? "");
  }, [selected?.id, selected?.nome]);

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
    if (form.senha.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }

    setCreating(true);
    const signupClient = createSignupClient();
    const { data, error } = await signupClient.auth.signUp({
      email,
      password: form.senha,
      options: { data: { nome: nome || email } },
    });

    if (error || !data.user) {
      setCreating(false);
      toast.error(error?.message ?? "Não foi possível criar o usuário.");
      return;
    }

    const userId = data.user.id;

    const profileRes = await supabase
      .from("profiles")
      .upsert(
        { id: userId, email, nome: nome || email, ativo: true },
        { onConflict: "id" },
      );
    if (profileRes.error) {
      toast.warning(
        `Conta criada, mas o perfil não pôde ser gravado: ${profileRes.error.message}`,
      );
    }

    if (form.role === "admin") {
      const roleRes = await applyRole(userId, "admin");
      if (roleRes.error) {
        toast.warning(
          `Conta criada, mas o papel de administrador falhou: ${roleRes.error.message}`,
        );
      }
    }


    setCreating(false);
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    toast.success("Usuário criado com sucesso.");
    await load();
    setSelectedId(userId);
  }

  async function saveNome(user: ManagedUser) {
    const nome = nomeDraft.trim();
    if (nome === (user.nome ?? "")) return;
    setSavingNome(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome || null })
      .eq("id", user.id);
    setSavingNome(false);
    if (error) {
      toast.error("Não foi possível salvar o nome.");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, nome: nome || null } : u)),
    );
    toast.success("Nome atualizado.");
  }

  async function toggleAtivo(user: ManagedUser, ativo: boolean) {
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, ativo } : u)),
    );
    const { error } = await supabase
      .from("profiles")
      .update({ ativo })
      .eq("id", user.id);
    if (error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ativo: !ativo } : u)),
      );
      toast.error("Não foi possível alterar o status da conta.");
      return;
    }
    toast.success(ativo ? "Conta ativada." : "Conta desativada.");
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

  async function changeRole(user: ManagedUser, role: AppRole) {
    const previous = user.role;
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));

    const res = await applyRole(user.id, role);
    if (res.error) {
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
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-2xl">
          {selected && (
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
                    <div className="flex gap-2">
                      <Input
                        id="nome"
                        className="rounded-none"
                        value={nomeDraft}
                        onChange={(e) => setNomeDraft(e.target.value)}
                        onBlur={() => void saveNome(selected)}
                      />
                      <Button
                        variant="secondary"
                        className="rounded-none"
                        disabled={savingNome}
                        onClick={() => void saveNome(selected)}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Conta ativa
                    </span>
                    <div className="flex h-10 items-center gap-3">
                      <Switch
                        checked={selected.ativo}
                        disabled={selected.id === authz.userId}
                        onCheckedChange={(v) => void toggleAtivo(selected, v)}
                        aria-label="Conta ativa"
                      />
                      <span className="text-sm text-muted-foreground">
                        {selected.ativo ? "Ativa" : "Desativada"}
                      </span>
                    </div>
                  </div>
                </div>

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
              </div>

              <DialogFooter>
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
                  className="rounded-none"
                  onClick={() => setSelectedId(null)}
                >
                  Concluir
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
                placeholder="Mínimo de 6 caracteres"
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
