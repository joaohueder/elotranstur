import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSeo } from "@/lib/seo";
import { supabase, setRememberMe } from "@/lib/supabase";

import loginHero from "../assets/login-hero.jpg";

export default function LoginPage() {
  useSeo({
    title: "Login — ELO Transporte e Turismo",
    description:
      "Acesse o painel da ELO: gestão de viagens, leads, CRM, site e landing pages.",
  });

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email || !password) {
      toast.error("Informe e-mail e senha.");
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      // Define a persistência ANTES do login: com "Manter conectado" a
      // sessão é salva por 30 dias; sem, expira ao fechar a aba.
      setRememberMe(rememberMe);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      navigate("/", { replace: true });
    } catch {
      const message = "E-mail ou senha inválidos.";
      setAuthError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Informe seu e-mail para redefinir a senha.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de redefinição para seu e-mail.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans lg:flex-row">
      {/* Left Column: Branding & Atmosphere */}
      <div className="relative hidden w-[58%] items-center justify-center overflow-hidden bg-primary p-12 lg:flex">
        <div className="absolute inset-0">
          <img
            src={loginHero}
            alt="Ônibus executivo em estrada brasileira ao pôr do sol"
            className="h-full w-full object-cover opacity-40"
            width={1280}
            height={1024}
          />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-10 px-3 place-items-center rounded-sm bg-brand-accent text-xl font-serif font-bold italic text-primary-foreground">
              ELO
            </div>
            <span className="font-serif text-2xl tracking-tight text-primary-foreground">
              TRANSPORTE E TURISMO
            </span>
          </div>

          <h1 className="mb-6 font-serif text-5xl leading-tight italic text-primary-foreground">
            Gestão completa para o seu{" "}
            <span className="text-brand-accent">turismo</span>.
          </h1>

          <div className="space-y-6">
            <p className="text-lg font-light leading-relaxed text-primary-foreground/80">
              Viagens, leads, CRM, site institucional e landing pages em um só
              painel para operadoras de transporte e turismo.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Login Interface */}
      <div className="flex flex-1 flex-col justify-center bg-muted px-8 py-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="grid h-8 px-2 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
              ELO
            </div>
            <span className="font-serif text-xl tracking-tight">
              TRANSPORTE E TURISMO
            </span>
          </div>

          <div className="mb-10">
            <h2 className="mb-2 font-serif text-3xl text-foreground">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground">
              Insira suas credenciais para gerenciar suas operações.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mb-6 border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                E-MAIL
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-none border-border bg-background px-4 py-3 placeholder:text-muted-foreground/50 focus:border-brand-accent focus:ring-0"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Senha
                </Label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs font-medium text-brand-accent hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-none border-border bg-background px-4 py-3 placeholder:text-muted-foreground/50 focus:border-brand-accent focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-3 py-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="rounded-sm border-border data-[state=checked]:border-brand-accent data-[state=checked]:bg-brand-accent"
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal text-muted-foreground"
              >
                Ficar conectado por 30 dias
              </Label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-none bg-primary py-6 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
            >
              {loading ? "Processando..." : "Acessar painel"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
