import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";

/**
 * Placeholder do painel autenticado. O sistema será construído a partir daqui.
 * A validação usa getUser(), que revalida o token no servidor de auth.
 */
export default function Home() {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? "in" : "out");
    });

    supabase.auth.getUser().then(({ data }) => {
      if (active) setStatus(data.user ? "in" : "out");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return <div className="min-h-screen bg-muted" />;
  }
  if (status === "out") {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-8 text-center font-sans">
      <div className="mb-6 grid h-12 px-4 place-items-center rounded-sm bg-brand-accent font-serif text-2xl font-bold italic text-primary-foreground">
        ELO
      </div>
      <h1 className="font-serif text-3xl text-foreground">
        Acesso autorizado
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Painel da ELO Transporte e Turismo. Os módulos do sistema serão
        adicionados a partir desta tela.
      </p>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-8 rounded-none bg-primary px-8 py-4 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
      >
        Sair
      </button>
    </main>
  );
}
