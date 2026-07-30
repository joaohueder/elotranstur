import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck, Trash2, User as UserIcon } from "lucide-react";
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

  const load = useCallback(async () => {
    setLoading(true);

    // Garante que contas recém-criadas em auth.users tenham perfil/papel.
    const syncRes = await supabase.rpc("admin_sync_profiles");
    if (syncRes.error) {
      console.warn("[usuarios] admin_sync_profiles:", syncRes.error.message);
    }

    const [profilesRes, rolesRes, permsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, nome, ativo").order("email"),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("user_permissions")
        .select("user_id, modulo, can_view, can_edit, can_delete"),
    ]);

    if (profilesRes.error) {
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
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sistema
          </p>
          <h1 className="mt-2 font-serif text-4xl text-foreground">Usuários</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Crie contas, defina papéis e libere individualmente visualização,
            edição e exclusão por módulo.
          </p>
        </div>
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
                    {!u.ativo && (
                      <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">
                        inativo
                      </span>
                    )}
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
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                    {selected.role === "admin" ? (
                      <ShieldCheck className="size-5 text-brand-accent" />
                    ) : (
                      <UserIcon className="size-5 text-brand-accent" />
                    )}
                    {selected.nome || selected.email}
                  </CardTitle>
                  <CardDescription>{selected.email}</CardDescription>
                </div>
                {selected.id !== authz.userId && (
                  <Button
                    variant="outline"
                    className="rounded-none text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 className="size-4" />
                    Excluir
                  </Button>
                )}
              </CardHeader>

              <CardContent className="space-y-8">
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
