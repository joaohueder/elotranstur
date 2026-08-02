import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Frown, Loader2, MessageCircle } from "lucide-react";

import { LandingView, type LandingViagem } from "@/components/landing/landing-view";
import { PublicShell } from "@/components/public-shell";
import { supabase } from "@/lib/supabase";
import { rastrearMeta } from "@/lib/meta-ads";
import { useSeo } from "@/lib/seo";
import { useLayoutSettings } from "@/lib/layout-settings";
import { capaDa } from "@/lib/viagens";
import { contextoDaVisita, marcarVisitaLead } from "@/lib/visitas";



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
      // RPC pública: devolve somente nome e WhatsApp (e-mails ficam protegidos).
      const { data } = await supabase.rpc("empresa_publica");
      if (ativo && data) setEmpresa(data as { nome: string; whatsapp: string });
    })();
    return () => {
      ativo = false;
    };
  }, []);

  /** Monta o link do WhatsApp da empresa com o nome e o destino/UF de interesse. */
  function montarWhatsapp(dados: { nome: string; whatsapp: string }): string | null {
    const digitos = (empresa?.whatsapp ?? "").replace(/\D/g, "");
    if (digitos.length < 10 || !viagem) return null;
    const numero = digitos.length <= 11 ? `55${digitos}` : digitos;
    const local = [viagem.destino, viagem.uf]
      .filter(Boolean)
      .join(" / ");
    const texto =
      `Olá! Meu nome é ${dados.nome} e tenho interesse em viajar para ${local}. ` +
      `Gostaria de receber mais informações sobre formas de pagamento e tudo o que está incluso no pacote. Pode me ajudar?`;
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

    // Marca a visita atual como convertida em lead (Dashboard).
    void marcarVisitaLead(dados.whatsapp);

    // Notifica a empresa (e os e-mails em cópia) sobre o novo lead.
    void (async () => {
      try {
        const contexto = await contextoDaVisita();
        await supabase.functions.invoke("password-reset", {
          body: {
            action: "lead-notify",
            slug,
            nome: dados.nome,
            whatsapp: dados.whatsapp,
            origem: "Landing Page",
            contexto: { ...contexto, referrer: document.referrer || "" },
          },
        });
      } catch {
        /* a notificação nunca bloqueia o lead */
      }
    })();





    // Meta Ads: conversão de Lead (Pixel + API de Conversões, deduplicados).
    void rastrearMeta("Lead", {
      userData: { nome: dados.nome, whatsapp: dados.whatsapp },
      customData: {
        content_name: tituloViagem,
        content_category: [viagem?.destino, viagem?.uf].filter(Boolean).join("/"),
      },
    });

    return null;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!viagem || viagem.situacao !== "ativa") {
    const digitos = (empresa?.whatsapp ?? "").replace(/\D/g, "");
    const numero = digitos.length <= 11 ? `55${digitos}` : digitos;
    const texto =
      "Olá! Tentei acessar uma viagem que não está mais disponível. " +
      "Poderia me enviar as próximas viagens e destinos disponíveis?";
    const link =
      digitos.length >= 10
        ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
        : null;

    return (
      <div className="grid min-h-screen place-items-center bg-muted px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-background shadow-sm">
            <Frown className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="mt-5 font-serif text-2xl text-foreground sm:text-3xl">
            Viagem indisponível
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Esta viagem não existe ou já foi encerrada. Fale com a gente para
            conhecer os próximos destinos disponíveis.
          </p>
          {link && (
            <button
              type="button"
              title="Fala com a nossa equipe pelo WhatsApp para conhecer as próximas viagens."
              onClick={() => {
                window.location.href = link;
              }}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[hsl(142_70%_35%)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 sm:w-auto sm:text-base"
            >
              <MessageCircle className="h-5 w-5" />
              Falar Agora no WhatsApp
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PublicShell>
      <LandingView
        viagem={viagem}
        onSubmit={enviarLead}
        whatsappUrl={montarWhatsapp}
      />
    </PublicShell>
  );
}
