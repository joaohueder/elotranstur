import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

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

  return (
    <AppShell>
      <h1 className="font-serif text-4xl text-foreground">
        Bem-vindo de volta
      </h1>
      <p className="mt-2 text-muted-foreground">
        Sessão ativa para{" "}
        <span className="font-medium text-foreground">{user.email}</span>.
      </p>
    </AppShell>
  );
}
