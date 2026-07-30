import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { LayoutSettingsProvider } from "@/lib/layout-settings";
import { supabase } from "@/lib/supabase";
import Login from "@/pages/Login";
import Painel from "@/pages/Painel";
import Configuracoes from "@/pages/Configuracoes";
import Usuarios from "@/pages/Usuarios";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

/** Rota protegida: exige sessão ativa no Supabase auto-hospedado. */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setStatus(error || !data.user ? "out" : "in");
    });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (status === "loading") {
    return <div className="min-h-screen bg-background" />;
  }
  if (status === "out") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AuthSync() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
      }
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LayoutSettingsProvider>
        <BrowserRouter>
          <AuthSync />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/painel"
              element={
                <RequireAuth>
                  <Painel />
                </RequireAuth>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <RequireAuth>
                  <Configuracoes />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </LayoutSettingsProvider>
    </QueryClientProvider>
  );
}
