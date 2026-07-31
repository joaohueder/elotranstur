/**
 * Modelos visuais de landing page das viagens.
 *
 * São três modelos, todos construídos com a mesma base mobile-first e as
 * mesmas seções de alta conversão (oferta, prova social, escassez, formulário).
 * O que muda entre eles é a estrutura do topo, a tipografia e o ritmo visual.
 * A COR não faz parte do modelo: vem da paleta (ver `landing-palettes.ts`).
 */

import { DEFAULT_LANDING_PALETTE } from "./landing-palettes";

/** Estrutura visual do topo da página. */
export type LandingHero =
  | "imersivo"   // foto em tela cheia com texto sobreposto
  | "editorial"  // foto e conteúdo lado a lado (empilhados no celular)
  | "vitrine";   // cartão flutuante sobre faixa colorida

/** Estilo do botão principal. */
export type LandingCta = "solido" | "gradiente" | "brilho";

export type LandingFonts = {
  /** Fonte dos títulos */
  titulo: string;
  /** Fonte do corpo de texto */
  corpo: string;
  /** Trecho da URL do Google Fonts */
  google: string;
};

export type LandingModel = {
  key: string;
  nome: string;
  descricao: string;
  hero: LandingHero;
  fonts: LandingFonts;
  /** Títulos em caixa alta */
  caixaAlta: boolean;
  /** Espaçamento entre letras dos títulos */
  tracking: string;
  /** Peso dos títulos */
  peso: number;
  radius: string;
  cta: LandingCta;
  ctaLabel: string;
  /** Conjunto de ícones usado nas informações */
  icones: "classico" | "viagem" | "bussola";
  /** Paleta sugerida ao escolher o modelo */
  paletaPadrao: string;
};

const f = (titulo: string, corpo: string, google: string): LandingFonts => ({
  titulo,
  corpo,
  google,
});

export const LANDING_MODELS: LandingModel[] = [
  {
    key: "aurora",
    nome: "Aurora",
    descricao:
      "Editorial e elegante: foto ao lado da oferta, formulário sempre à vista no computador.",
    hero: "editorial",
    fonts: f(
      "'Fraunces', serif",
      "'Plus Jakarta Sans', sans-serif",
      "Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700",
    ),
    caixaAlta: false,
    tracking: "-0.02em",
    peso: 700,
    radius: "1rem",
    cta: "solido",
    ctaLabel: "Falar Agora no WhatsApp",
    icones: "classico",
    paletaPadrao: "areia-dourada",
  },
  {
    key: "impacto",
    nome: "Impacto",
    descricao:
      "Foto em tela cheia, promessa forte e botão já no primeiro olhar. Ideal para tráfego pago.",
    hero: "imersivo",
    fonts: f(
      "'Sora', sans-serif",
      "'Inter', sans-serif",
      "Sora:wght@600;700;800&family=Inter:wght@400;500;600;700",
    ),
    caixaAlta: false,
    tracking: "-0.03em",
    peso: 800,
    radius: "0.875rem",
    cta: "gradiente",
    ctaLabel: "Falar Agora no WhatsApp",
    icones: "viagem",
    paletaPadrao: "azul-noturno",
  },
  {
    key: "vitrine",
    nome: "Vitrine",
    descricao:
      "Cartão flutuante sobre faixa colorida: leve, moderno e ótimo para redes sociais.",
    hero: "vitrine",
    fonts: f(
      "'Outfit', sans-serif",
      "'Figtree', sans-serif",
      "Outfit:wght@500;600;700&family=Figtree:wght@400;500;600;700",
    ),
    caixaAlta: false,
    tracking: "-0.02em",
    peso: 700,
    radius: "1.375rem",
    cta: "brilho",
    ctaLabel: "Falar Agora no WhatsApp",
    icones: "bussola",
    paletaPadrao: "oceano",
  },
];

export const DEFAULT_LANDING_MODEL = "aurora";

export function getLandingModel(key: string | null | undefined): LandingModel {
  return (
    LANDING_MODELS.find((m) => m.key === key) ??
    LANDING_MODELS.find((m) => m.key === DEFAULT_LANDING_MODEL)!
  );
}

export { DEFAULT_LANDING_PALETTE };

/** Gera um endereço amigável (slug) a partir de um texto. */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
