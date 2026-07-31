import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

/**
 * Passo 1 da recuperação de senha: o usuário informa o e-mail e recebe
 * um código de 6 caracteres. Em seguida vai para /verificar-codigo.
 */
export function ForgotPasswordModal({
  open,
  onOpenChange,
  defaultEmail = "",
}: ForgotPasswordModalProps) {
  const navigate = useNavigate();
  const { showNegative, showError } = useFeedback();

  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const alvo = email.trim().toLowerCase();
    if (!alvo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo)) {
      showNegative(
        "E-mail inválido",
        "Informe um endereço de e-mail válido para receber o código de recuperação.",
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(alvo, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      onOpenChange(false);
      navigate(`/verificar-codigo?email=${encodeURIComponent(alvo)}`);
    } catch (err) {
      showError(
        "Falha ao enviar o código",
        "Não conseguimos enviar o código de recuperação para o seu e-mail. Tente novamente em instantes e, se persistir, envie os detalhes abaixo ao administrador do sistema.",
        err,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-none p-0">
        <div className="h-1 w-full bg-brand-accent" />

        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-3 p-6 text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-accent/10 text-brand-accent">
                <KeyRound className="h-5 w-5" />
              </span>
              <DialogTitle className="font-serif text-2xl font-normal">
                Recuperar senha
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              Informe o e-mail cadastrado. Enviaremos um código de 6 caracteres
              para você confirmar sua identidade e criar uma nova senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-6 pb-6">
            <Label
              htmlFor="recovery-email"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              E-MAIL
            </Label>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="nome@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-none border-border bg-background px-4 py-3 focus:border-brand-accent focus:ring-0"
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 border-t border-border bg-muted/50 p-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-none text-xs font-semibold uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-none bg-primary px-6 py-5 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
