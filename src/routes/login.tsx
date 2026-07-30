import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, setRememberMe } from "@/lib/supabase";

import loginHero from "../assets/login-hero.jpg";




export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — ELO Transporte e Turismo" },
      {
        name: "description",
        content:
          "Acesse o painel da ELO: gestão de viagens, leads, CRM, site e landing pages.",
      },
      { property: "og:title", content: "Login — ELO Transporte e Turismo" },
      {
        property: "og:description",
        content:
          "Acesse o painel da ELO: gestão de viagens, leads, CRM, site e landing pages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
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
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/painel` },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
        setMode("signin");
      } else {
        // Define a persistência ANTES do login: com "Manter conectado" a
        // sessão é salva por 30 dias; sem, expira ao fechar a aba.
        setRememberMe(rememberMe);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/painel", replace: true });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível continuar.",
      );
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
            <div className="grid size-10 place-items-center rounded-sm bg-brand-accent text-xl font-serif font-bold italic text-primary-foreground">
              E
            </div>
            <span className="font-serif text-2xl tracking-tight text-primary-foreground">
              ELO TRANSPORTE E TURISMO
            </span>
          </div>

          <h1 className="mb-6 font-serif text-5xl leading-tight italic text-primary-foreground">
            Gestão completa para o seu{" "}
            <span className="text-brand-accent">turismo</span>.
          </h1>

          <div className="space-y-6">
            <p className="text-lg font-light leading-relaxed text-primary-foreground/80">
              Viagens, leads, CRM, site institucional e landing pages em um
              só painel para operadoras de transporte e turismo.
            </p>

          </div>
        </div>

      </div>

      {/* Right Column: Login Interface */}
      <div className="flex flex-1 flex-col justify-center bg-muted px-8 py-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="grid size-8 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
              E
            </div>
            <span className="font-serif text-xl tracking-tight">ELO</span>
          </div>

          <div className="mb-10">
            <h2 className="mb-2 font-serif text-3xl text-foreground">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground">
              Insira suas credenciais para gerenciar suas operações.
            </p>
          </div>

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
                Lembrar deste dispositivo por 30 dias
              </Label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-none bg-primary py-6 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
            >
              {loading
                ? "Processando..."
                : mode === "signup"
                  ? "Criar conta"
                  : "Acessar painel"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup"
                ? "Já possui acesso? "
                : "Ainda não tem conta? "}
              <button
                type="button"
                onClick={() =>
                  setMode(mode === "signup" ? "signin" : "signup")
                }
                className="font-medium text-brand-accent hover:underline"
              >
                {mode === "signup" ? "Entrar" : "Cadastre-se"}
              </button>
            </p>
          </form>


        </div>
      </div>
    </div>
  );
}
