import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { FeedbackProvider } from "@/lib/feedback";
import { LayoutSettingsProvider } from "@/lib/layout-settings";
import { useAuthz } from "@/lib/use-authz";
import Crm from "@/pages/Crm";
import LeadForm from "@/pages/LeadForm";
import Configuracoes from "@/pages/Configuracoes";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import ResetPassword from "@/pages/ResetPassword";
import UsuarioForm from "@/pages/UsuarioForm";
import Usuarios from "@/pages/Usuarios";
import VerifyCode from "@/pages/VerifyCode";
import Viagens from "@/pages/Viagens";
import ViagemForm from "@/pages/ViagemForm";

const queryClient = new QueryClient();

/** Protege uma rota exigindo autenticação e permissão de visualização no módulo. */
function RequireModule({
  modulo,
  children,
}: {
  modulo: string;
  children: ReactNode;
}) {
  const { loading, authenticated, isAdmin, permissoes } = useAuthz();

  if (loading) return <div className="min-h-screen bg-muted" />;
  if (!authenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !permissoes[modulo]?.view) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <LayoutSettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verificar-codigo" element={<VerifyCode />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/crm"
              element={
                <RequireModule modulo="crm">
                  <Crm />
                </RequireModule>
              }
            />
            <Route
              path="/crm/leads/novo"
              element={
                <RequireModule modulo="crm">
                  <LeadForm />
                </RequireModule>
              }
            />
            <Route
              path="/crm/leads/:id"
              element={
                <RequireModule modulo="crm">
                  <LeadForm />
                </RequireModule>
              }
            />
            <Route
              path="/usuarios"
              element={
                <RequireModule modulo="usuarios">
                  <Usuarios />
                </RequireModule>
              }
            />
            <Route
              path="/usuarios/novo"
              element={
                <RequireModule modulo="usuarios">
                  <UsuarioForm />
                </RequireModule>
              }
            />
            <Route
              path="/usuarios/:id"
              element={
                <RequireModule modulo="usuarios">
                  <UsuarioForm />
                </RequireModule>
              }
            />


            <Route
              path="/configuracoes"
              element={
                <RequireModule modulo="configuracoes">
                  <Configuracoes />
                </RequireModule>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </LayoutSettingsProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  );
}
