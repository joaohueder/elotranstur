import { Navigate } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { useAuthz } from "@/lib/use-authz";

/** Painel autenticado da ELO. Os módulos são acessados pela barra de menu. */
export default function Home() {
  const { loading, authenticated, nome, email } = useAuthz();

  if (loading) return <div className="min-h-screen bg-muted" />;
  if (!authenticated) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <div className="border border-border bg-background p-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Painel
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground">
          Bem-vindo, {nome || email}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Use a barra de menu para acessar os módulos disponíveis conforme suas
          permissões.
        </p>
      </div>
    </AppShell>
  );
}
