import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import loginHero from "../assets/login-hero.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Gestão de Transporte e Turismo" },
      {
        name: "description",
        content:
          "Acesse o painel de gestão integrada para operadoras de transporte e turismo.",
      },
      { property: "og:title", content: "Login — Gestão de Transporte e Turismo" },
      {
        property: "og:description",
        content:
          "Acesse o painel de gestão integrada para operadoras de transporte e turismo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Intencionalmente sem integração com banco de dados por enquanto.
    // eslint-disable-next-line no-console
    console.log({ email, password, rememberMe });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans lg:flex-row">
      {/* Left Column: Branding & Atmosphere */}
      <div className="relative hidden w-[58%] items-center justify-center overflow-hidden bg-primary p-12 lg:flex">
        <div className="absolute inset-0">
          <img
            src={loginHero}
            alt="Trem de alta velocidade atravessando montanhas ao amanhecer"
            className="h-full w-full object-cover opacity-40"
            width={1200}
            height={1600}
          />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-sm bg-brand-accent text-xl font-serif font-bold italic text-primary-foreground">
              H
            </div>
            <span className="font-serif text-2xl tracking-tight text-primary-foreground">
              Horizonte
            </span>
          </div>

          <h1 className="mb-6 font-serif text-5xl leading-tight italic text-primary-foreground">
            Gestão integrada para as{" "}
            <span className="text-brand-accent">melhores</span> jornadas.
          </h1>

          <div className="space-y-6">
            <p className="text-lg font-light leading-relaxed text-primary-foreground/80">
              O sistema unificado para operadoras de turismo premium e frotas
              de transporte de passageiros.
            </p>

            <div className="flex gap-8 pt-4">
              <div>
                <div className="font-serif text-2xl text-primary-foreground">
                  2.4k
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Veículos
                </div>
              </div>
              <div>
                <div className="font-serif text-2xl text-primary-foreground">
                  140
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Destinos
                </div>
              </div>
              <div>
                <div className="font-serif text-2xl text-primary-foreground">
                  99.9%
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Disponibilidade
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 left-12 right-12 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-primary-foreground/40">
          <span>Desde 2024</span>
          <span>Padrão em Mobilidade e Turismo</span>
        </div>
      </div>

      {/* Right Column: Login Interface */}
      <div className="flex flex-1 flex-col justify-center bg-muted px-8 py-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="grid size-8 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
              H
            </div>
            <span className="font-serif text-xl tracking-tight">Horizonte</span>
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
                E-mail corporativo
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
                <Link
                  to="/login"
                  className="text-xs font-medium text-brand-accent hover:underline"
                >
                  Esqueceu a senha?
                </Link>
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
              className="w-full rounded-none bg-primary py-6 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
            >
              Acessar painel
            </Button>
          </form>

          <div className="mt-10 flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Acesso institucional
            </span>
            <Separator className="flex-1" />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="rounded-none border-border bg-background py-5 text-xs font-medium hover:bg-accent"
            >
              Azure AD
            </Button>
            <Button
              variant="outline"
              className="rounded-none border-border bg-background py-5 text-xs font-medium hover:bg-accent"
            >
              Okta SSO
            </Button>
          </div>

          <p className="mt-12 text-center text-sm text-muted-foreground">
            Não tem uma conta de operador?{" "}
            <Link
              to="/login"
              className="font-semibold text-foreground hover:underline"
            >
              Solicite parceria
            </Link>
          </p>
        </div>

        <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-16 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Link to="/login" className="hover:text-brand-accent">
            Termos de serviço
          </Link>
          <Link to="/login" className="hover:text-brand-accent">
            Privacidade
          </Link>
          <Link to="/login" className="hover:text-brand-accent">
            Segurança
          </Link>
          <span className="ml-auto text-muted-foreground/60">v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
