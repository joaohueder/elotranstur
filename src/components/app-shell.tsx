import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Users, Settings } from "lucide-react";
import { useState } from "react";

import { MODULES } from "@/lib/permissions";
import { supabase, clearRememberMe } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Users> = {
  usuarios: Users,
  configuracoes: Settings,
};

const PATHS: Record<string, string> = {
  usuarios: "/usuarios",
  configuracoes: "/configuracoes",
};

/**
 * Layout padrão do sistema ELO: header fixo + barra de menu fixa + main + rodapé.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { can, nome, email, isAdmin, refresh } = useAuthz();
  const [refreshing, setRefreshing] = useState(false);

  const items = MODULES.filter((m) => can(m.key, "view"));

  async function handleLogout() {
    clearRememberMe();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted font-sans">
      {/* HEADER FIXO */}
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border bg-background">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-14 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
              ELO
            </span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:block">
              Transporte e Turismo
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden text-right leading-tight md:block">
              <p className="text-sm font-medium text-foreground">
                {nome || email}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {isAdmin ? "Administrador" : "Usuário"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              title="Atualizar permissões"
              className="grid h-9 w-9 place-items-center rounded-sm border border-border text-muted-foreground hover:bg-muted"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 items-center gap-2 rounded-sm bg-primary px-4 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* BARRA DE MENU FIXA */}
      <nav className="fixed inset-x-0 top-16 z-30 h-12 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-1 px-6">
          {items.map((m) => {
            const Icon = ICONS[m.key] ?? Users;
            const path = PATHS[m.key] ?? `/${m.key}`;
            const active = pathname.startsWith(path);
            return (
              <Link
                key={m.key}
                to={path}
                className={cn(
                  "flex h-full items-center gap-2 border-b-2 px-4 text-[11px] font-semibold uppercase tracking-widest transition-colors",
                  active
                    ? "border-brand-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  m.key === "configuracoes" && "ml-auto",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* MAIN */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-10 pt-[7.5rem]">
        {children}
      </main>

      {/* RODAPÉ */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:flex-row">
          <span>ELO Transporte e Turismo</span>
          <span>Sistema de gestão · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
