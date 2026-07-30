import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Transporte e Turismo" },
      {
        name: "description",
        content:
          "Plataforma de gestão integrada para operadoras de transporte e turismo.",
      },
      { property: "og:title", content: "Gestão de Transporte e Turismo" },
      {
        property: "og:description",
        content:
          "Plataforma de gestão integrada para operadoras de transporte e turismo.",
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
