import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeedback } from "@/lib/feedback";
import {
  EMPTY_PERMISSION,
  MODULES,
  normalizePermissions,
  type ModulePermission,
  type PermissionMap,
} from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type FormState = {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  isAdmin: boolean;
  ativo: boolean;
  permissoes: PermissionMap;
};

const EMPTY_FORM: FormState = {
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
  isAdmin: false,
  ativo: true,
  permissoes: {},
};

export default function UsuarioForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refresh } = useAuthz();
  const { showSuccess, showNegative, showError } = useFeedback();

  const editando = Boolean(id);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(editando);
  const [saving, setSaving] = useState(false);
  const [aba, setAba] = useState("dados");

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    setLoading(false);
    if (error) {
      showError(
        "Falha ao carregar usuário",
        "Não foi possível obter os dados do usuário.",
        error,
      );
      return;
    }
    const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    const u = list.find((row) => String(row.id) === id);
    if (!u) {
      showNegative("Usuário não encontrado", "O usuário solicitado não existe mais.");
      navigate("/usuarios", { replace: true });
      return;
    }
    setForm({
      nome: (u.nome as string) ?? "",
      email: String(u.email ?? ""),
      senha: "",
      confirmarSenha: "",
      isAdmin: Boolean(u.is_admin),
      ativo: Boolean(u.ativo),
      permissoes: normalizePermissions(u.permissoes),
    });
  }, [id, navigate, showError, showNegative]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (form.isAdmin && aba === "modulos") setAba("dados");
  }, [form.isAdmin, aba]);

  function permissaoDe(modulo: string): ModulePermission {
    return form.permissoes[modulo] ?? EMPTY_PERMISSION;
  }

  function togglePermissao(modulo: string, acao: keyof ModulePermission, value: boolean) {
    setForm((prev) => {
      const atual = prev.permissoes[modulo] ?? EMPTY_PERMISSION;
      const next: ModulePermission = { ...atual, [acao]: value };
      if (acao !== "view" && value) next.view = true;
      if (acao === "view" && !value) {
        next.edit = false;
        next.delete = false;
      }
      return { ...prev, permissoes: { ...prev.permissoes, [modulo]: next } };
    });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      showNegative("Dados incompletos", "Informe o nome do usuário.");
      setAba("dados");
      return;
    }
    if (!editando) {
      if (!form.email.trim()) {
        showNegative("Dados incompletos", "Informe o e-mail do usuário.");
        setAba("dados");
        return;
      }
      if (form.senha.length < 8) {
        showNegative("Senha inválida", "A senha deve ter no mínimo 8 caracteres.");
        setAba("dados");
        return;
      }
    } else if (form.senha && form.senha.length < 8) {
      showNegative("Senha inválida", "A nova senha deve ter no mínimo 8 caracteres.");
      setAba("dados");
      return;
    }

    if (form.senha && form.senha !== form.confirmarSenha) {
      showNegative("Senhas diferentes", "A confirmação de senha não confere com a senha informada.");
      setAba("dados");
      return;
    }

    setSaving(true);
    try {
      if (editando) {
        const { error } = await supabase.rpc("admin_save_user", {
          _user_id: id,
          _nome: form.nome.trim(),
          _is_admin: form.isAdmin,
          _ativo: form.ativo,
          _permissoes: form.permissoes,
          _nova_senha: form.senha || null,
        });
        if (error) throw error;
        showSuccess("Usuário atualizado", `As alterações de ${form.nome} foram salvas.`);
      } else {
        const { error } = await supabase.rpc("admin_create_user", {
          _email: form.email.trim(),
          _senha: form.senha,
          _nome: form.nome.trim(),
          _is_admin: form.isAdmin,
          _ativo: form.ativo,
          _permissoes: form.permissoes,
        });
        if (error) throw error;
        showSuccess("Usuário criado", `${form.nome} já pode acessar o sistema.`);
      }
      await refresh();
      navigate("/usuarios");
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? "Erro desconhecido ao salvar.";
      showError("Falha ao salvar usuário", message, err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Módulo · Usuários
            </p>
            <h1 className="font-serif text-3xl text-foreground">
              {editando ? "Editar usuário" : "Novo usuário"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina os dados de acesso, o papel e as permissões por módulo.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-sm"
            onClick={() => navigate("/usuarios")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="border border-border bg-background">
            <Tabs value={aba} onValueChange={setAba}>
              <div className="border-b border-border px-6 pt-6">
                <TabsList className="rounded-sm">
                  <TabsTrigger value="dados" className="rounded-sm">
                    Dados do Usuário
                  </TabsTrigger>
                  {!form.isAdmin && (
                    <TabsTrigger value="modulos" className="rounded-sm">
                      Módulos
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="dados" className="m-0 p-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest">Nome</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                      className="rounded-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest">E-mail</Label>
                    <Input
                      type="email"
                      value={form.email}
                      disabled={editando}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="rounded-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest">
                      {editando ? "Nova senha (opcional)" : "Senha"}
                    </Label>
                    <Input
                      type="password"
                      value={form.senha}
                      onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                      placeholder="Mínimo de 8 caracteres"
                      className="rounded-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest">
                      Confirmar senha
                    </Label>
                    <Input
                      type="password"
                      value={form.confirmarSenha}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, confirmarSenha: e.target.value }))
                      }
                      placeholder="Repita a senha"
                      className="rounded-sm"
                    />
                    {form.confirmarSenha && form.senha !== form.confirmarSenha && (
                      <p className="text-xs text-destructive">As senhas não conferem.</p>
                    )}
                  </div>


                  <div className="flex items-center justify-between border border-border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Administrador</p>
                      <p className="text-xs text-muted-foreground">
                        Acesso total a todos os módulos.
                      </p>
                    </div>
                    <Switch
                      checked={form.isAdmin}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, isAdmin: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between border border-border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Usuário ativo</p>
                      <p className="text-xs text-muted-foreground">
                        Se desativado, o acesso é bloqueado imediatamente.
                      </p>
                    </div>
                    <Switch
                      checked={form.ativo}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))}
                    />
                  </div>
                </div>
              </TabsContent>

              {!form.isAdmin && (
                <TabsContent value="modulos" className="m-0 p-6">
                  <div className="overflow-hidden rounded-sm border border-border">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-2.5">
                      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Permissões por módulo
                      </span>
                      <div className="grid grid-cols-3 gap-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span className="w-14">Ver</span>
                        <span className="w-14">Editar</span>
                        <span className="w-14">Excluir</span>
                      </div>
                    </div>

                    {MODULES.map((m) => {
                      const p = permissaoDe(m.key);
                      return (
                        <div
                          key={m.key}
                          className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
                        >
                          <span className="truncate text-sm text-foreground">
                            {m.label}
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {(["view", "edit", "delete"] as const).map((acao) => (
                              <div key={acao} className="flex w-14 justify-center">
                                <Checkbox
                                  aria-label={`${acao} ${m.label}`}
                                  checked={p[acao]}
                                  onCheckedChange={(v) =>
                                    togglePermissao(m.key, acao, Boolean(v))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full rounded-sm sm:w-auto"
                  onClick={() => navigate("/usuarios")}
                >
                  Cancelar
                </Button>
                <Button
                  className="w-full rounded-sm sm:w-auto sm:min-w-32"
                  disabled={saving}
                  onClick={() => void salvar()}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </AppShell>
  );
}
