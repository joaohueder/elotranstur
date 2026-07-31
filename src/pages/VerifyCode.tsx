import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useFeedback } from "@/lib/feedback";
import { useSeo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

/**
 * Passo 2 da recuperação de senha: confirmação do código de 6 caracteres
 * enviado por e-mail. Em caso de sucesso, a sessão de recuperação é criada
 * e o usuário segue para /reset-password.
 */
export default function VerifyCodePage() {
  useSeo({
    title: "Confirmar código — ELO Transporte e Turismo",
    description: "Confirme o código enviado por e-mail para redefinir sua senha.",
  });

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showSuccess, showNegative, showError } = useFeedback();

  const email = (params.get("email") ?? "").trim().toLowerCase();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!email) {
      showNegative(
        "E-mail não informado",
        "Solicite novamente o código de recuperação na tela de login.",
      );
      navigate("/login", { replace: true });
    }
  }, [email, navigate, showNegative]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const verify = async (token: string) => {
    if (loading || verifiedRef.current) return;

    if (token.length !== CODE_LENGTH) {
      showNegative(
        "Código incompleto",
        `Informe os ${CODE_LENGTH} caracteres do código enviado para o seu e-mail.`,
      );
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "recovery",
      });

      if (error) {
        const invalido =
          error.status === 400 ||
          error.status === 401 ||
          /invalid|expired|token/i.test(error.message);

        if (invalido) {
          showNegative(
            "Código inválido ou expirado",
            "Confira o código recebido por e-mail ou solicite um novo envio.",
          );
          setCode("");
        } else {
          showError(
            "Falha ao confirmar o código",
            "Não conseguimos validar o código informado. Tente novamente em instantes e, se persistir, envie os detalhes abaixo ao administrador do sistema.",
            error,
          );
        }
        return;
      }

      if (!data.session) {
        showNegative(
          "Não foi possível confirmar",
          "O código foi aceito, mas a sessão de recuperação não foi criada. Solicite um novo código.",
        );
        return;
      }

      verifiedRef.current = true;
      navigate("/reset-password", { replace: true });
    } catch (err) {
      showError(
        "Erro inesperado",
        "Não conseguimos confirmar o código. Verifique sua conexão e tente novamente.",
        err,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      setCode("");
      setCooldown(RESEND_SECONDS);
      showSuccess(
        "Novo código enviado",
        "Enviamos um novo código de 6 caracteres para o seu e-mail. Verifique também a caixa de spam.",
      );
    } catch (err) {
      showError(
        "Falha ao reenviar o código",
        "Não conseguimos enviar um novo código. Tente novamente em instantes.",
        err,
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-muted px-8 py-16 font-sans lg:px-24">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-12 flex items-center gap-3">
          <div className="grid h-10 place-items-center rounded-sm bg-brand-accent px-3 font-serif text-xl font-bold italic text-primary-foreground">
            ELO
          </div>
          <span className="font-serif text-xl tracking-tight">
            TRANSPORTE E TURISMO
          </span>
        </div>

        <div className="mb-10">
          <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-brand-accent/10 text-brand-accent">
            <MailCheck className="h-5 w-5" />
          </span>
          <h2 className="mb-2 font-serif text-3xl text-foreground">
            Confirme o código
          </h2>
          <p className="text-muted-foreground">
            Enviamos um código de 6 caracteres para{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Informe-o abaixo para continuar.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="space-y-6"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Código de verificação
            </span>
            <HelpTip texto="Digite os 6 caracteres que chegaram no seu e-mail. Verifique também o spam." />
          </div>
          <InputOTP
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(value) => {
              const normalizado = value.toUpperCase();
              setCode(normalizado);
              if (normalizado.length === CODE_LENGTH) void verify(normalizado);
            }}
          >
            <InputOTPGroup className="w-full justify-between gap-2">
              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-14 flex-1 rounded-none border-border bg-background font-serif text-xl"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <HintButton
            hint="Confere o código digitado e libera a criação da nova senha"
            type="submit"
            disabled={loading}
            className="w-full rounded-none bg-primary py-6 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {loading ? "Confirmando..." : "Confirmar código"}
          </HintButton>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              title="Envia um novo código para o seu e-mail"
              className="font-medium text-brand-accent hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0
                ? `Reenviar código em ${cooldown}s`
                : "Reenviar código"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              title="Cancela a recuperação e volta para a tela de login"
              className="font-medium text-muted-foreground hover:underline"
            >
              Voltar para o login
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
