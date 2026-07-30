import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase, clearRememberMe } from "@/lib/supabase";

const navItems = [
  { to: "/painel", label: "Painel" },
  { to: "/configuracoes", label: "Configurações" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    clearRememberMe();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted font-sans">
      <header className="border-b border-border bg-background">
        <div className="app-container flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-8">
            <Link to="/painel" className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
                E
              </div>
              <span className="font-serif text-xl tracking-tight">
                ELO TRANSPORTE E TURISMO
              </span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Button
            variant="outline"
            className="rounded-none text-xs font-semibold uppercase tracking-widest"
            onClick={handleSignOut}
          >
            Sair
          </Button>
        </div>
      </header>

      <main className="app-container px-8 py-12">{children}</main>
    </div>
  );
}
