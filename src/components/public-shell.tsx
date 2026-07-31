import type { ReactNode } from "react";

/**
 * Container das páginas públicas (landing pages, login, recuperação de senha).
 * Respeita a largura máxima configurada no módulo Configurações › Layout.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-muted">
      <div className="mx-auto w-full max-w-[var(--app-max-width,1280px)] bg-background shadow-sm">
        {children}
      </div>
    </div>
  );
}
