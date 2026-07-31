import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { LandingView, type LandingViagem } from "@/components/landing/landing-view";
import { supabase } from "@/lib/supabase";
import { useSeo } from "@/lib/seo";
import { useLayoutSettings } from "@/lib/layout-settings";
import { capaDa } from "@/lib/viagens";


/** Landing page pública de uma viagem (/v/:slug). */
export default function LandingViagem() {
  const { slug } = useParams();
  const [viagem, setViagem] = useState<LandingViagem | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<{ nome: string; whatsapp: string } | null>(
    null,
  );
  const { seo } = useLayoutSettings();

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

  /** WhatsApp da empresa (Configurações › Empresa). */
  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("app_empresa")
        .select("nome, whatsapp")
        .maybeSingle();
      if (ativo && data) setEmpresa(data as { nome: string; whatsapp: string });
    })();
    return () => {
      ativo = false;
    };
  }, []);

  /** Monta o link do WhatsApp da empresa com o nome e o destino de interesse. */
  function montarWhatsapp(dados: { nome: string; whatsapp: string }): string | null {
    const digitos = (empresa?.whatsapp ?? "").replace(/\D/g, "");
    if (digitos.length < 10 || !viagem) return null;
    const numero = digitos.length <= 11 ? `55${digitos}` : digitos;
    const destino = viagem.titulo || viagem.destino;
    const texto =
      `Olá! Meu nome é ${dados.nome} e tenho interesse na viagem para ${destino}. ` +
      `Meu WhatsApp é ${dados.whatsapp}.`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  const tituloViagem = viagem?.titulo || viagem?.destino || "";
  const descricaoCompartilhada = viagem
    ? [tituloViagem, viagem.subtitulo].filter(Boolean).join(" — ") ||
      (viagem.descricao ?? "").slice(0, 155) ||
      `Viagem para ${viagem.destino}. Garanta sua vaga com a ELO Transporte e Turismo.`
    : seo.description;

  useSeo({
    title: viagem
      ? `${tituloViagem} · ${seo.siteName}`
      : `Viagem · ${seo.siteName}`,
    description: descricaoCompartilhada,
    image: (viagem ? capaDa(viagem.imagens ?? []) : null) || seo.imageUrl || null,
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
