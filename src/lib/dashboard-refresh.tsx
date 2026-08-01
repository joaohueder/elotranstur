import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Ciclo padrão de atualização do Dashboard (30 segundos). */
export const DASHBOARD_REFRESH_MS = 30_000;

interface DashboardRefreshContextValue {
  /** Incrementado a cada ciclo de atualização. */
  tick: number;
  /** Momento da última atualização sincronizada. */
  lastUpdated: Date;
}

const DashboardRefreshContext = createContext<DashboardRefreshContextValue | null>(null);

/** Provedor que sincroniza todas as fontes de dados do Dashboard no mesmo ciclo de 30s. */
export function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setLastUpdated(new Date());
    }, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DashboardRefreshContext.Provider value={{ tick, lastUpdated }}>
      {children}
    </DashboardRefreshContext.Provider>
  );
}

/** Hook para acessar o ciclo de atualização sincronizada do Dashboard. */
export function useDashboardRefresh() {
  const ctx = useContext(DashboardRefreshContext);
  if (!ctx) {
    throw new Error("useDashboardRefresh deve ser usado dentro de DashboardRefreshProvider");
  }
  return ctx;
}
