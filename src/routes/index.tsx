import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ELO Transporte e Turismo" },
      {
        name: "description",
        content:
          "Plataforma de gestão de viagens, leads, CRM, site e landing pages para operadoras de transporte e turismo.",
      },
      { property: "og:title", content: "ELO Transporte e Turismo" },
      {
        property: "og:description",
        content:
          "Plataforma de gestão de viagens, leads, CRM, site e landing pages para operadoras de transporte e turismo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Navigate to="/login" />;
}
