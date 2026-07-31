import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { HelpTip, HintButton } from "@/components/help";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFeedback } from "@/lib/feedback";
import { redefinirSenhaComToken, resetTokenStore } from "@/lib/password-reset";
import { useSeo } from "@/lib/seo";

export default function ResetPasswordPage() {
  useSeo({
    title: "Redefinir senha — ELO Transporte e Turismo",
    description: "Defina uma nova senha de acesso ao painel da ELO.",
  });

  const navigate = useNavigate();
  const { showSuccess, showNegative, showError } = useFeedback();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // O acesso a esta tela depende do token gerado após a confirmação do
  // código de 6 dígitos enviado pelo SMTP do sistema.
  useEffect(() => {
    if (resetTokenStore.get()) {
      setReady(true);
      return;
    }
    showNegative(
      "Sessão de recuperação inválida",
      "Solicite um novo código de recuperação na tela de login.",
    );
  }, [showNegative]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password.length < 8) {
      showNegative(
        "Senha muito curta",
        "A nova senha deve ter pelo menos 8 caracteres.",
      );
      return;
    }
    if (password !== confirm) {
      showNegative(
        "Senhas diferentes",
        "A confirmação da senha não confere com a nova senha informada.",
      );
      return;
    }

    setLoading(true);
    try {
      const token = resetTokenStore.get();
      if (!token) throw new Error("Sessão de recuperação expirada.");

      await redefinirSenhaComToken(token, password);
      resetTokenStore.clear();

      showSuccess(
        "Senha atualizada",
        "Sua nova senha foi definida com sucesso. Faça login para acessar o painel.",
      );
      navigate("/login", { replace: true });
    } catch (err) {
      showError(
        "Falha ao redefinir a senha",
        "Não conseguimos atualizar sua senha. A sessão de recuperação pode ter expirado — solicite um novo código na tela de login.",
        err,
      );
    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-muted px-8 py-16 font-sans lg:px-24">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-12 flex items-center gap-3">
          <div className="grid h-10 px-3 place-items-center rounded-sm bg-brand-accent text-xl font-serif font-bold italic text-primary-foreground">
            ELO
          </div>
          <span className="font-serif text-xl tracking-tight">
            TRANSPORTE E TURISMO
          </span>
        </div>

        <div className="mb-10">
          <h2 className="mb-2 font-serif text-2xl sm:text-3xl text-foreground">
            Definir nova senha
          </h2>
          <p className="text-muted-foreground">
            Escolha uma senha forte para proteger o acesso ao painel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="new-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Nova senha
              </Label>
              <HelpTip texto="Crie uma senha com pelo menos 8 caracteres, misturando letras e números." />
            </div>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-none border-border bg-background px-4 py-3 focus:border-brand-accent focus:ring-0"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="confirm-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Confirmar nova senha
              </Label>
              <HelpTip texto="Digite a mesma senha de novo para evitar erro de digitação." />
            </div>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-none border-border bg-background px-4 py-3 focus:border-brand-accent focus:ring-0"
            />
          </div>

          <HintButton
            hint="Grava a nova senha e libera o acesso ao painel"
            type="submit"
            disabled={loading || !ready}
            className="w-full rounded-none bg-primary py-6 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </HintButton>

          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            title="Cancela a troca de senha e volta para a tela de login"
            className="w-full text-xs font-medium text-brand-accent hover:underline"
          >
            Voltar para o login
          </button>

        </form>
      </div>
    </div>
  );
}
