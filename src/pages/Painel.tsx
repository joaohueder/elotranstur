import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useSeo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";

export default function PainelPage() {
  useSeo({
    title: "Painel — ELO Transporte e Turismo",
    description:
      "Painel da ELO: viagens, leads, CRM, site institucional e landing pages.",
  });

  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <h1 className="font-serif text-4xl text-foreground">
        Bem-vindo de volta
      </h1>
      <p className="mt-2 text-muted-foreground">
        Sessão ativa para{" "}
        <span className="font-medium text-foreground">{email}</span>.
      </p>
    </AppShell>
  );
}
