import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, Save, UserCog } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FieldLabel, HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

/** Tela de edição do perfil do usuário logado (nome e senha). */
export default function Perfil() {
  const { loading, authenticated, userId, email, nome, refresh } = useAuthz();
  const feedback = useFeedback();
  const navigate = useNavigate();

  const [nomeValor, setNomeValor] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNomeValor(nome ?? "");
  }, [nome]);

  if (loading) return <div className="min-h-screen bg-muted" />;
  if (!authenticated) return <Navigate to="/login" replace />;

  async function salvar() {
    if (!nomeValor.trim()) {
      feedback.showError(
        "Nome obrigatório",
        "Informe o seu nome para continuar.",
      );
      return;
    }
    if (senha && senha.length < 6) {
      feedback.showError(
        "Senha muito curta",
        "A nova senha precisa ter pelo menos 6 caracteres.",
      );
      return;
    }
    if (senha !== confirmar) {
      feedback.showError(
        "Senhas diferentes",
        "A confirmação precisa ser igual à nova senha.",
      );
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nome: nomeValor.trim() })
        .eq("id", userId as string);
      if (error) throw error;

      if (senha) {
        const { error: errSenha } = await supabase.auth.updateUser({
          password: senha,
        });
        if (errSenha) throw errSenha;
      }

      await refresh();
      setSenha("");
      setConfirmar("");
      feedback.showSuccess(
        "Perfil atualizado",
        senha
          ? "Seus dados e sua senha foram salvos com sucesso."
          : "Seus dados foram salvos com sucesso.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar o perfil",
        "Ocorreu um erro ao gravar os seus dados. Tente novamente.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
          Minha conta · Perfil
        </p>
        <h1 className="mt-2 font-serif text-2xl sm:text-3xl text-foreground">Editar perfil</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Atualize o seu nome e, se quiser, defina uma nova senha de acesso.
        </p>
      </div>

      <div className="rounded-sm border border-border bg-background p-4 sm:p-6">
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
            <UserCog className="h-4 w-4" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              Dados da minha conta
              <HelpTip texto="São as suas informações pessoais de acesso ao sistema." />
            </p>
            <p className="text-xs text-muted-foreground">
              O e-mail de acesso não pode ser alterado por aqui.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel help="E-mail usado para entrar no sistema. Somente o administrador pode alterar.">
              E-mail
            </FieldLabel>
            <Input value={email ?? ""} readOnly disabled className="rounded-sm" />
          </div>

          <div className="space-y-1.5">
            <FieldLabel help="Nome que aparece no topo do sistema e nos registros.">
              Nome
            </FieldLabel>
            <Input
              value={nomeValor}
              onChange={(e) => setNomeValor(e.target.value)}
              placeholder="Seu nome"
              className="rounded-sm"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel help="Deixe em branco se não quiser trocar a senha agora.">
              Nova senha
            </FieldLabel>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="rounded-sm"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel help="Digite a nova senha novamente para confirmar.">
              Confirmar nova senha
            </FieldLabel>
            <Input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="••••••••"
              className="rounded-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <HintButton
            hint="Volta para o painel sem salvar as alterações."
            variant="outline"
            className="w-full rounded-sm sm:w-auto"
            disabled={salvando}
            onClick={() => navigate("/")}
          >
            Cancelar
          </HintButton>
          <HintButton
            hint="Grava as alterações do seu perfil."
            className="w-full rounded-sm sm:w-auto sm:min-w-32"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </HintButton>
        </div>
      </div>
    </AppShell>
  );
}
