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
  LogOut,
  Wifi,
  WifiOff,
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
import { useConfirm } from "@/lib/confirm";
import { tempoDeVida } from "@/lib/crm";
import { useFeedback } from "@/lib/feedback";
import { MODULES, normalizePermissions, type PermissionMap } from "@/lib/permissions";
import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { cn, formatarTempoRestante } from "@/lib/utils";


type UsuarioRow = {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
  permissoes: PermissionMap;
  online: boolean;
  last_seen_at: string | null;
  last_seen_page: string | null;
  sessao_iniciada_em: string | null;
  sessao_atualizada_em: string | null;
  sessao_expira_em: string | null;
  sessao_remember: boolean | null;
  sessao_ip: string | null;
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
  const { confirm } = useConfirm();
  const [agora, setAgora] = useState(() => Date.now());

  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos" | "admins">("todos");

  const [toDelete, setToDelete] = useState<UsuarioRow | null>(null);


  const podeEditar = can("usuarios", "edit");
  const podeExcluir = can("usuarios", "delete");

  const carregar = useCallback(async (silencioso = false) => {
    // Evita chamar a RPC sem sessão (ex.: logo após o logout), o que geraria
    // "permission denied for function admin_list_users".
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) return;

    if (!silencioso) setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    setLoading(false);
    if (error) {
      const { data: aindaLogado } = await supabase.auth.getSession();
      if (!aindaLogado.session) return;
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
        online: Boolean(u.online),
        last_seen_at: (u.last_seen_at as string) ?? null,
        last_seen_page: (u.last_seen_page as string) ?? null,
        sessao_iniciada_em: (u.sessao_iniciada_em as string) ?? null,
        sessao_atualizada_em: (u.sessao_atualizada_em as string) ?? null,
        sessao_expira_em: (u.sessao_expira_em as string) ?? null,
        sessao_remember:
          u.sessao_remember === null || u.sessao_remember === undefined
            ? null
            : Boolean(u.sessao_remember),
        sessao_ip: (u.sessao_ip as string) ?? null,
      })),
    );
  }, [showError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Atualiza o marcador de "logado há" a cada segundo.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Mantém as informações de sessão (online / IP) atualizadas.
  useEffect(() => {
    const id = window.setInterval(() => void carregar(true), 30_000);
    return () => window.clearInterval(id);
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

  async function forcarLogoff(u: UsuarioRow) {
    if (!podeEditar) return;
    const ok = await confirm({
      title: "Forçar logoff",
      message: `Tem certeza que deseja encerrar a sessão de ${u.nome ?? u.email}? A pessoa precisará fazer login novamente.`,
      confirmText: "Sim, encerrar sessão",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("admin_force_logout", { _user_id: u.id });
    if (error) {
      showError(
        "Falha ao encerrar sessão",
        error.message ?? "Não foi possível encerrar a sessão deste usuário.",
        error,
      );
      return;
    }
    if (u.id === userId) {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === u.id
          ? {
              ...r,
              online: false,
              sessao_iniciada_em: null,
              sessao_atualizada_em: null,
              sessao_expira_em: null,
              sessao_remember: null,
              sessao_ip: null,
            }
          : r,
      ),
    );
    showSuccess(
      "Sessão encerrada",
      `${u.nome ?? u.email} foi desconectado do sistema.`,
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
            <h1 className="font-serif text-2xl sm:text-3xl text-foreground">Usuários</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie acessos, papéis e permissões do sistema.
            </p>
          </div>
          {isAdmin && (
            <HintButton
              hint="Cria um novo usuário com acesso ao sistema."
              onClick={abrirNovo}
              className="w-full rounded-sm sm:w-auto"
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
              className="flex items-center gap-3 border border-border bg-background p-4 sm:gap-4 sm:p-5"
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
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
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
                  "h-11 shrink-0 rounded-sm border px-4 text-[11px] font-semibold uppercase tracking-widest transition-colors",
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
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {filtrados.map((u) => {
              const isOnline = u.online;
              return (
              <article
                key={u.id}
                className={cn(
                  "flex flex-col border transition-shadow hover:shadow-lg",
                  isOnline
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-border bg-background",
                )}
              >
                <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-6">
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

                <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-4 sm:px-6 text-[11px] text-muted-foreground">
                  <div>
                    <p className="flex items-center gap-1 uppercase tracking-widest">
                      Presença
                      <HelpTip texto="Página onde o usuário foi visto pela última vez e há quanto tempo." />
                    </p>
                    <div className="mt-0.5 flex flex-col gap-0.5 text-foreground">
                      {u.online ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="truncate font-medium">
                              {u.last_seen_page || "Painel"}
                            </span>
                          </div>
                          <span className="text-[9px] text-muted-foreground ml-5">
                            Ativo há {tempoDeVida(u.last_seen_at || u.sessao_atualizada_em || new Date().toISOString())}
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <WifiOff className="h-3.5 w-3.5" />
                          <span>Não logado</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 uppercase tracking-widest">
                      Sessão
                      <HelpTip texto="Início da sessão e endereço IP utilizado." />
                    </p>
                    <div className="mt-0.5 space-y-0.5 text-foreground">
                      <p className="truncate">
                        {u.sessao_iniciada_em ? tempoDeVida(u.sessao_iniciada_em) : "—"}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        IP: {u.sessao_ip || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-4 sm:px-6 text-[11px] text-muted-foreground">
                  <div>
                    <p className="flex items-center gap-1 uppercase tracking-widest">
                      Expira em
                      <HelpTip texto="Tempo restante até a sessão expirar." />
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {!u.online
                        ? "—"
                        : u.sessao_remember === false
                          ? "No logoff"
                          : u.sessao_expira_em
                            ? formatarTempoRestante(u.sessao_expira_em, agora)
                            : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 uppercase tracking-widest">
                      Último acesso
                      <HelpTip texto="Data do último login realizado no sistema." />
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {formatarData(u.last_sign_in_at)}
                    </p>
                  </div>
                </div>
                      {formatarData(u.last_sign_in_at)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border px-4 py-4 sm:px-6">
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

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border px-4 py-4 sm:px-6">
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
                    hint="Encerra a sessão ativa deste usuário, obrigando-o a fazer login novamente."
                    variant="outline"
                    size="sm"
                    className="rounded-sm"
                    disabled={!podeEditar || !u.online}
                    onClick={() => void forcarLogoff(u)}
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Logoff
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
            );})}
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
