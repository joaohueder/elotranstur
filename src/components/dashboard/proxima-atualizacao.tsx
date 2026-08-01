import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { HelpTip } from "@/components/help";
import { DASHBOARD_REFRESH_MS } from "@/lib/dashboard-refresh";

interface ProximaAtualizacaoProps {
  /** Momento da última atualização sincronizada (opcional). */
  lastUpdated?: Date;
}

/** Barra de regressão que indica quando os dados do dashboard serão atualizados. */
export function ProximaAtualizacao({ lastUpdated }: ProximaAtualizacaoProps) {
  const [restante, setRestante] = useState(DASHBOARD_REFRESH_MS);

  useEffect(() => {
    const inicio = lastUpdated ? lastUpdated.getTime() : Date.now();
    const id = window.setInterval(() => {
      const decorrido = (Date.now() - inicio) % DASHBOARD_REFRESH_MS;
      setRestante(DASHBOARD_REFRESH_MS - decorrido);
    }, 200);
    return () => window.clearInterval(id);
  }, [lastUpdated]);

  const segundos = Math.ceil(restante / 1000);
  const progresso = (restante / DASHBOARD_REFRESH_MS) * 100;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-3 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:px-6">
      <div className="app-container">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Próxima atualização
            <HelpTip texto="Os dados do dashboard são recarregados automaticamente. A barra mostra quanto falta para a próxima atualização." />
          </p>
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {segundos}s
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>
    </div>
  );
}
