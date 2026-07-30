import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, LogOut, Settings, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase, clearRememberMe } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

const navItems = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard, adminOnly: false },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    adminOnly: false,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    clearRememberMe();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted font-sans">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="app-container flex items-center justify-between px-8 py-5">
          <Link to="/painel" className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-sm bg-brand-accent px-1 font-serif text-sm font-bold italic tracking-tight text-primary-foreground">
              ELO
            </div>
            <span className="font-serif text-xl tracking-tight">
              TRANSPORTE E TURISMO
            </span>
          </Link>

          <div className="flex items-center gap-5">
            {email && (
              <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:inline">
                {email}
              </span>
            )}
            <Button
              variant="outline"
              className="rounded-none text-xs font-semibold uppercase tracking-widest"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 size-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Barra de menu horizontal */}
      <nav className="border-b border-border bg-background/60 backdrop-blur">
        <div className="app-container flex items-center gap-1 overflow-x-auto px-8">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors hover:text-foreground",
                  isActive
                    ? "border-brand-accent text-foreground"
                    : "border-transparent text-muted-foreground",
                ].join(" ")
              }
            >
              <item.icon className="size-3.5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="app-container flex-1 px-8 py-12">{children}</main>

      {/* Rodapé */}
      <footer className="border-t border-border bg-background">
        <div className="app-container flex flex-col items-center justify-between gap-2 px-8 py-6 text-xs uppercase tracking-widest text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} ELO Transporte e Turismo
          </span>
          <span>Painel administrativo · v1.0</span>
        </div>
      </footer>
    </div>
  );
}
