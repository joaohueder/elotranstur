import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { LandingView, type LandingViagem } from "@/components/landing/landing-view";
import { supabase } from "@/lib/supabase";
import { useSeo } from "@/lib/seo";
import { capaDa } from "@/lib/viagens";


/** Landing page pública de uma viagem (/v/:slug). */
export default function LandingViagem() {
  const { slug } = useParams();
  const [viagem, setViagem] = useState<LandingViagem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("landing_viagem", { _slug: slug });
      if (!ativo) return;
      const v = (data ?? null) as LandingViagem | null;
      setViagem(v);
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [slug]);

  const tituloViagem = viagem?.titulo || viagem?.destino || "";
  const descricaoCompartilhada = viagem
    ? [tituloViagem, viagem.subtitulo].filter(Boolean).join(" — ") ||
      (viagem.descricao ?? "").slice(0, 155) ||
      `Viagem para ${viagem.destino}. Garanta sua vaga com a ELO Transporte e Turismo.`
    : "Conheça as viagens da ELO Transporte e Turismo.";

  useSeo({
    title: viagem
      ? `${tituloViagem} · ELO Transporte e Turismo`
      : "Viagem · ELO Transporte e Turismo",
    description: descricaoCompartilhada,
    image: viagem ? capaDa(viagem.imagens ?? []) : null,
  });


  async function enviarLead(dados: {
    nome: string;
    whatsapp: string;
  }): Promise<string | null> {
    const { data, error } = await supabase.rpc("landing_lead", {
      _slug: slug,
      _nome: dados.nome,
      _whatsapp: dados.whatsapp,
    });
    if (error) {
      console.error("landing_lead error", error);
      const codigo = (error as { code?: string }).code;
      return `Não foi possível enviar agora${codigo ? ` (${codigo})` : ""}: ${
        error.message || "erro desconhecido"
      }`;
    }
    const res = (data ?? {}) as { ok?: boolean; message?: string };
    if (!res.ok) return res.message || "Não foi possível enviar agora.";
    return null;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!viagem) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl text-foreground">
            Página não encontrada
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta viagem não está mais disponível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <LandingView viagem={viagem} onSubmit={enviarLead} />
    </div>
  );
}
