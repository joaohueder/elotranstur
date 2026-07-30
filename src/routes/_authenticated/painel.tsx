import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — ELO Transporte e Turismo" },
      {
        name: "description",
        content:
          "Painel da ELO: viagens, leads, CRM, site institucional e landing pages.",
      },
      { property: "og:title", content: "Painel — ELO Transporte e Turismo" },
      {
        property: "og:description",
        content:
          "Painel da ELO: viagens, leads, CRM, site institucional e landing pages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted font-sans">
      <header className="flex items-center justify-between border-b border-border bg-background px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-sm bg-brand-accent font-serif text-lg font-bold italic text-primary-foreground">
            E
          </div>
          <span className="font-serif text-xl tracking-tight">
            ELO TRANSPORTE E TURISMO
          </span>
        </div>
        <Button
          variant="outline"
          className="rounded-none text-xs font-semibold uppercase tracking-widest"
          onClick={handleSignOut}
        >
          Sair
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-16">
        <h1 className="font-serif text-4xl text-foreground">
          Bem-vindo de volta
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sessão ativa para{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
      </main>
    </div>
  );
}
