import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users as UsersIcon,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HelpTip, HintButton } from "@/components/help";
import { useFeedback } from "@/lib/feedback";
import { MODULES, normalizePermissions, type PermissionMap } from "@/lib/permissions";
import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { cn } from "@/lib/utils";


type UsuarioRow = {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
  permissoes: PermissionMap;
};




function iniciais(nome: string | null, email: string) {
  const base = (nome || email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function formatarData(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function Usuarios() {
  const navigate = useNavigate();
  const { can, userId, isAdmin } = useAuthz();
  const { showSuccess, showNegative, showError } = useFeedback();

  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos" | "admins">("todos");

  const [toDelete, setToDelete] = useState<UsuarioRow | null>(null);


  const podeEditar = can("usuarios", "edit");
  const podeExcluir = can("usuarios", "delete");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    setLoading(false);
    if (error) {
      showError(
        "Falha ao carregar usuários",
        "Não foi possível obter a lista de usuários do sistema. Verifique sua conexão e suas permissões.",
        error,
      );
      return;
    }
    const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    setRows(
      list.map((u) => ({
        id: String(u.id),
        email: String(u.email ?? ""),
        nome: (u.nome as string) ?? null,
        ativo: Boolean(u.ativo),
        created_at: (u.created_at as string) ?? null,
        last_sign_in_at: (u.last_sign_in_at as string) ?? null,
        is_admin: Boolean(u.is_admin),
        permissoes: normalizePermissions(u.permissoes),
      })),
    );
  }, [showError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useRealtime(["profiles", "user_roles", "user_permissions"], () =>
    void carregar(true),
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((u) => {
      if (filtro === "ativos" && !u.ativo) return false;
      if (filtro === "inativos" && u.ativo) return false;
      if (filtro === "admins" && !u.is_admin) return false;
      if (!termo) return true;
      return (
        u.email.toLowerCase().includes(termo) ||
        (u.nome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [rows, busca, filtro]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      ativos: rows.filter((u) => u.ativo).length,
      inativos: rows.filter((u) => !u.ativo).length,
      admins: rows.filter((u) => u.is_admin).length,
    }),
    [rows],
  );

  function abrirNovo() {
    navigate("/usuarios/novo");
  }

  function abrirEdicao(u: UsuarioRow) {
    navigate(`/usuarios/${u.id}`);
  }


  async function alternarAtivo(u: UsuarioRow) {
    if (u.id === userId) {
      showNegative("Ação não permitida", "Você não pode desativar a própria conta.");
      return;
    }
    const { error } = await supabase.rpc("admin_save_user", {
      _user_id: u.id,
      _ativo: !u.ativo,
    });
    if (error) {
      showError(
        "Falha ao alterar status",
        error.message ?? "Não foi possível alterar o status do usuário.",
        error,
      );
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, ativo: !u.ativo } : r)));
    showSuccess(
      u.ativo ? "Usuário desativado" : "Usuário ativado",
      u.ativo
        ? `${u.nome ?? u.email} não poderá mais acessar o sistema.`
        : `${u.nome ?? u.email} voltou a ter acesso ao sistema.`,
    );
  }

  async function excluir() {
    if (!toDelete) return;
    const alvo = toDelete;
    setToDelete(null);
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: alvo.id });
    if (error) {
      showError(
        "Falha ao excluir usuário",
        error.message ?? "Não foi possível excluir o usuário.",
        error,
      );
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== alvo.id));
    showSuccess("Usuário excluído", `${alvo.nome ?? alvo.email} foi removido do sistema.`);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* Cabeçalho do módulo */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Módulo
            </p>
            <h1 className="font-serif text-3xl text-foreground">Usuários</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie acessos, papéis e permissões do sistema.
            </p>
          </div>
          {isAdmin && (
            <HintButton
              hint="Cria um novo usuário com acesso ao sistema."
              onClick={abrirNovo}
              className="rounded-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </HintButton>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total", value: stats.total, icon: UsersIcon, help: "Quantidade total de usuários cadastrados no sistema." },
            { label: "Ativos", value: stats.ativos, icon: UserCheck, help: "Usuários que podem acessar o sistema normalmente." },
            { label: "Inativos", value: stats.inativos, icon: UserX, help: "Usuários bloqueados, sem acesso ao sistema." },
            { label: "Administradores", value: stats.admins, icon: ShieldCheck, help: "Usuários com acesso total a todos os módulos." },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center gap-4 border border-border bg-background p-5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-sm bg-muted text-muted-foreground">
                <kpi.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-serif text-2xl text-foreground">{kpi.value}</p>
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {kpi.label}
                  <HelpTip texto={kpi.help} />
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Busca e filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="h-11 rounded-sm pl-9"
              title="Filtra a lista de usuários pelo nome ou e-mail digitado."
            />
          </div>
          <div className="flex gap-1">
            {(
              [
                ["todos", "Todos"],
                ["ativos", "Ativos"],
                ["inativos", "Inativos"],
                ["admins", "Admins"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                title={`Mostrar apenas usuários: ${label}`}
                onClick={() => setFiltro(key)}
                className={cn(
                  "h-11 rounded-sm border px-4 text-[11px] font-semibold uppercase tracking-widest transition-colors",
                  filtro === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards de usuários */}
        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="border border-dashed border-border bg-background py-20 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((u) => (
              <article
                key={u.id}
                className="flex flex-col border border-border bg-background transition-shadow hover:shadow-lg"
              >
                <div className="flex items-start gap-4 p-6">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-brand-accent font-serif text-base font-bold text-primary-foreground">
                    {iniciais(u.nome, u.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-serif text-lg text-foreground">
                      {u.nome || u.email}
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={cn(
                          "rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                          u.ativo
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {u.is_admin ? "Administrador" : "Usuário"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4 text-[11px] text-muted-foreground">
                  <div>
                    <p className="uppercase tracking-widest">Criado em</p>
                    <p className="mt-0.5 text-foreground">{formatarData(u.created_at)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest">Último acesso</p>
                    <p className="mt-0.5 text-foreground">
                      {formatarData(u.last_sign_in_at)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border px-6 py-4">
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Permissões
                    <HelpTip texto="Módulos que este usuário pode ver, editar ou excluir." />
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.is_admin ? (
                      <span className="rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-foreground">
                        Acesso total
                      </span>
                    ) : (
                      MODULES.filter((m) => u.permissoes[m.key]?.view).map((m) => (
                        <span
                          key={m.key}
                          className="rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-foreground"
                        >
                          {m.label}
                          {u.permissoes[m.key]?.edit ? " · edita" : ""}
                          {u.permissoes[m.key]?.delete ? " · exclui" : ""}
                        </span>
                      ))
                    )}
                    {!u.is_admin &&
                      MODULES.every((m) => !u.permissoes[m.key]?.view) && (
                        <span className="text-[11px] text-muted-foreground">
                          Nenhuma permissão atribuída
                        </span>
                      )}
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-border px-6 py-4">
                  <HintButton
                    hint="Abre a tela para editar os dados e permissões deste usuário."
                    variant="outline"
                    size="sm"
                    className="rounded-sm"
                    disabled={!podeEditar}
                    onClick={() => abrirEdicao(u)}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </HintButton>
                  <HintButton
                    hint={u.ativo ? "Bloqueia o acesso deste usuário ao sistema." : "Libera novamente o acesso deste usuário."}
                    variant="outline"
                    size="sm"
                    className="rounded-sm"
                    disabled={!isAdmin || u.id === userId}
                    onClick={() => void alternarAtivo(u)}
                  >
                    {u.ativo ? (
                      <>
                        <UserX className="mr-2 h-3.5 w-3.5" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <UserCheck className="mr-2 h-3.5 w-3.5" />
                        Ativar
                      </>
                    )}
                  </HintButton>
                  <HintButton
                    hint="Remove definitivamente este usuário do sistema."
                    variant="ghost"
                    size="sm"
                    className="ml-auto rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={!podeExcluir || u.id === userId}
                    onClick={() => setToDelete(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </HintButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Cadastro/edição em tela dedicada: /usuarios/novo e /usuarios/:id */}


      {/* Modal excluir */}
      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Excluir usuário</DialogTitle>
            <DialogDescription>
              Esta ação é permanente. {toDelete?.nome ?? toDelete?.email} perderá o acesso
              e seus dados de conta serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <HintButton
              hint="Fecha esta janela sem excluir o usuário."
              variant="outline"
              className="rounded-sm"
              onClick={() => setToDelete(null)}
            >
              Cancelar
            </HintButton>
            <HintButton
              hint="Confirma a exclusão permanente deste usuário."
              variant="destructive"
              className="rounded-sm"
              onClick={() => void excluir()}
            >
              Excluir definitivamente
            </HintButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
