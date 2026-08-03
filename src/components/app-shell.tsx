import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Menu,
  LogOut,
  RefreshCw,
  Users,
  Settings,
  KanbanSquare,
  Bus,
  UserPlus,
  UserCog,
  LayoutDashboard,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";

import { APP_VERSION } from "@/lib/version";


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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MODULES } from "@/lib/permissions";

import { supabase, clearRememberMe } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { useApplyTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";


const ICONS: Record<string, typeof Users> = {
  dashboard: LayoutDashboard,
  viagens: Bus,
  crm: KanbanSquare,
  leads: UserPlus,
  usuarios: Users,
  configuracoes: Settings,
};

const PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  viagens: "/viagens",
  crm: "/crm",
  leads: "/leads",
  usuarios: "/usuarios",
  configuracoes: "/configuracoes",
};

/** Explicações simples de cada módulo, exibidas ao passar o mouse no menu. */
const MENU_HINTS: Record<string, string> = {
  dashboard: "Visão geral de visitas e leads em números e gráficos.",
  viagens: "Cadastre e acompanhe as viagens da empresa.",
  crm: "Acompanhe seus leads e o andamento das negociações.",
  leads: "Veja todos os leads cadastrados em formato de lista.",
  usuarios: "Crie usuários e defina o que cada um pode acessar.",
  configuracoes: "Ajustes gerais do sistema, como layout, e-mail e CRM.",
};


/**
 * Componente que rastreia a presença do usuário autenticado no sistema.
 * Atualiza a página atual e o horário da última atividade a cada 30s.
 */
function PresenceTracker() {
  const { pathname } = useLocation();
  const { userId } = useAuthz();

  useEffect(() => {
    if (!userId) return;

    const update = async () => {
      // Evita atualizar em rotas de login/auth ou públicas
      if (pathname.startsWith("/login") || pathname.startsWith("/v/")) return;
      
      try {
        await supabase.rpc("update_user_presence", { _path: pathname });
      } catch (err) {
        console.warn("Falha ao atualizar presença:", err);
      }
    };

    void update();
    const timer = setInterval(() => void update(), 30_000); // 30 segundos
    return () => clearInterval(timer);
  }, [pathname, userId]);

  return null;
}

/**
 * Layout padrão do sistema ELO: header fixo + barra de menu fixa + main + rodapé.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { can, nome, email, isAdmin, refresh } = useAuthz();
  const [refreshing, setRefreshing] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const { theme, toggle } = useTheme();
  useApplyTheme();

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
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-muted font-sans">
      <PresenceTracker />
      {/* HEADER FIXO */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background sm:h-16">
        <div className="app-container flex h-full items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2">
            {/* MENU MOBILE (gaveta lateral) */}
            <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir o menu do sistema"
                  title="Abre o menu com os módulos do sistema."
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-border text-foreground hover:bg-muted sm:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[86vw] max-w-xs flex-col p-0">
                <SheetTitle className="sr-only">Menu do sistema</SheetTitle>

                <div className="flex items-center gap-3 border-b border-border px-4 py-4">
                  <span className="grid h-9 w-14 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
                    ELO
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Transporte e Turismo
                  </span>
                </div>

                <nav className="flex flex-col gap-1 p-3">
                  {items.map((m) => {
                    const Icon = ICONS[m.key] ?? Users;
                    const path = PATHS[m.key] ?? `/${m.key}`;
                    const active = pathname.startsWith(path);
                    return (
                      <Link
                        key={m.key}
                        to={path}
                        onClick={() => setMenuAberto(false)}
                        className={cn(
                          "flex items-start gap-3 rounded-sm border px-3 py-3 transition-colors",
                          active
                            ? "border-brand-accent bg-muted"
                            : "border-transparent hover:bg-muted",
                        )}
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 h-5 w-5 shrink-0",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {m.label}
                          </span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {MENU_HINTS[m.key] ?? `Abrir o módulo ${m.label}.`}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-auto border-t border-border p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAberto(false);
                      void handleLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm font-semibold text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-5 w-5" />
                    Sair do sistema
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/dashboard" className="flex items-center gap-2 sm:gap-3" title="Vai para o painel principal do sistema.">
            <span className="grid h-8 w-12 place-items-center rounded-sm bg-brand-accent font-serif text-base font-bold italic text-primary-foreground sm:h-9 sm:w-14 sm:text-lg">
              ELO
            </span>
            <span
              className="hidden leading-tight sm:block"
              title={`Versão atual do sistema: ${APP_VERSION}.`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Transporte e Turismo
              </span>
              <span className="block text-[10px] font-medium tracking-[0.12em] text-muted-foreground/70">
                Versão {APP_VERSION}
              </span>
            </span>

            </Link>
          </div>

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

                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-sm"
                  onSelect={(e) => {
                    e.preventDefault();
                    toggle();
                  }}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  <span className="flex-1">
                    Tema {theme === "dark" ? "claro" : "escuro"}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      Alterne o visual do painel. O padrão é claro.
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
      <nav className="fixed inset-x-0 top-14 z-30 hidden h-12 border-b border-border bg-background/95 backdrop-blur sm:top-16 sm:block">
        <div className="app-container no-scrollbar flex h-full items-center gap-1 overflow-x-auto px-2 sm:px-6">
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
                      "flex h-full shrink-0 items-center gap-2 border-b-2 px-3 text-[11px] font-semibold uppercase tracking-widest transition-colors sm:px-4",
                      active
                        ? "border-brand-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                      m.key === "configuracoes" && "sm:ml-auto",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{m.label}</span>
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
      <main className="app-container w-full flex-1 px-3 pb-10 pt-[4.75rem] sm:px-6 sm:pt-[7.5rem]">
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
