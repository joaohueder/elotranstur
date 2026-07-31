import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/lib/confirm";
import { FeedbackProvider } from "@/lib/feedback";

import { LayoutSettingsProvider } from "@/lib/layout-settings";
import { useAuthz } from "@/lib/use-authz";
import Crm from "@/pages/Crm";
import LeadForm from "@/pages/LeadForm";
import Leads from "@/pages/Leads";
import Configuracoes from "@/pages/Configuracoes";
import Home from "@/pages/Home";
import LandingViagem from "@/pages/LandingViagem";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Perfil from "@/pages/Perfil";

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
      <TooltipProvider delayDuration={200}>
      <FeedbackProvider>
        <ConfirmProvider>
        <LayoutSettingsProvider>
        <BrowserRouter>

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route
              path="/v/:slug"
              element={
                <PublicShell>
                  <LandingViagem />
                </PublicShell>
              }
            />

            <Route
              path="/login"
              element={
                <PublicShell>
                  <Login />
                </PublicShell>
              }
            />
            <Route
              path="/verificar-codigo"
              element={
                <PublicShell>
                  <VerifyCode />
                </PublicShell>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicShell>
                  <ResetPassword />
                </PublicShell>
              }
            />

            <Route
              path="/viagens"
              element={
                <RequireModule modulo="viagens">
                  <Viagens />
                </RequireModule>
              }
            />
            <Route
              path="/viagens/nova"
              element={
                <RequireModule modulo="viagens">
                  <ViagemForm />
                </RequireModule>
              }
            />
            <Route
              path="/viagens/:id"
              element={
                <RequireModule modulo="viagens">
                  <ViagemForm />
                </RequireModule>
              }
            />
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
              path="/leads"
              element={
                <RequireModule modulo="leads">
                  <Leads />
                </RequireModule>
              }
            />
            <Route
              path="/leads/novo"
              element={
                <RequireModule modulo="leads">
                  <LeadForm />
                </RequireModule>
              }
            />
            <Route
              path="/leads/:id"
              element={
                <RequireModule modulo="leads">
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
        </ConfirmProvider>
      </FeedbackProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

