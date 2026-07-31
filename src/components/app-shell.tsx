import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  RefreshCw,
  Users,
  Settings,
  KanbanSquare,
  Bus,
  UserPlus,
  UserCog,
} from "lucide-react";
import { useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODULES } from "@/lib/permissions";

import { supabase, clearRememberMe } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { cn } from "@/lib/utils";


const ICONS: Record<string, typeof Users> = {
  viagens: Bus,
  crm: KanbanSquare,
  leads: UserPlus,
  usuarios: Users,
  configuracoes: Settings,
};

const PATHS: Record<string, string> = {
  viagens: "/viagens",
  crm: "/crm",
  leads: "/leads",
  usuarios: "/usuarios",
  configuracoes: "/configuracoes",
};

/** Explicações simples de cada módulo, exibidas ao passar o mouse no menu. */
const MENU_HINTS: Record<string, string> = {
  viagens: "Cadastre e acompanhe as viagens da empresa.",
  crm: "Acompanhe seus leads e o andamento das negociações.",
  leads: "Veja todos os leads cadastrados em formato de lista.",
  usuarios: "Crie usuários e defina o que cada um pode acessar.",
  configuracoes: "Ajustes gerais do sistema, como layout, e-mail e CRM.",
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
        <div className="app-container flex h-full items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-14 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
              ELO
            </span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:block">
              Transporte e Turismo
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Menu da minha conta"
                      className="flex h-10 items-center gap-2 rounded-sm border border-border px-2 text-left hover:bg-muted sm:px-3"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold uppercase text-primary-foreground">
                        {(nome || email || "?").charAt(0)}
                      </span>
                      <span className="hidden leading-tight md:block">
                        <span className="block text-sm font-medium text-foreground">
                          {nome || email}
                        </span>
                        <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                          {isAdmin ? "Administrador" : "Usuário"}
                        </span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs">
                  Abre o menu da sua conta: editar perfil, recarregar permissões
                  e sair do sistema.
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end" className="w-64 rounded-sm">
                <DropdownMenuLabel className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">
                    {nome || "Minha conta"}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-sm"
                  onSelect={() => navigate("/perfil")}
                >
                  <UserCog className="h-4 w-4" />
                  <span className="flex-1">
                    Editar perfil
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      Altere seu nome e sua senha.
                    </span>
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-sm"
                  onSelect={(e) => {
                    e.preventDefault();
                    void handleRefresh();
                  }}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", refreshing && "animate-spin")}
                  />
                  <span className="flex-1">
                    Recarregar permissões
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      Atualiza o que você pode acessar, sem sair do sistema.
                    </span>
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-sm text-destructive focus:text-destructive"
                  onSelect={() => void handleLogout()}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="flex-1">
                    Sair
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      Encerra a sessão e volta para o login.
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>

      {/* BARRA DE MENU FIXA */}
      <nav className="fixed inset-x-0 top-16 z-30 h-12 border-b border-border bg-background/95 backdrop-blur">
        <div className="app-container flex h-full items-center gap-1 px-6">
          {items.map((m) => {
            const Icon = ICONS[m.key] ?? Users;
            const path = PATHS[m.key] ?? `/${m.key}`;
            const active = pathname.startsWith(path);
            return (
              <Tooltip key={m.key}>
                <TooltipTrigger asChild>
                  <Link
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
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs">
                  {MENU_HINTS[m.key] ?? `Abrir o módulo ${m.label}.`}
                </TooltipContent>
              </Tooltip>
            );

          })}
        </div>
      </nav>

      {/* MAIN */}
      <main className="app-container flex-1 px-6 pb-10 pt-[7.5rem]">
        {children}
      </main>

      {/* RODAPÉ */}
      <footer className="border-t border-border bg-background">
        <div className="app-container flex flex-col items-center justify-between gap-2 px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:flex-row">
          <span>ELO Transporte e Turismo</span>
          <span>Sistema de gestão · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
