/**
 * Modelos visuais de landing page das viagens.
 *
 * Cada modelo combina um layout (estrutura da página) com uma paleta de cores
 * e uma família tipográfica. São 15 combinações prontas para escolher no
 * cadastro da viagem.
 */

export type LandingLayout =
  | "split"      // imagem de um lado, conteúdo do outro
  | "overlay"    // foto grande com texto sobreposto
  | "stack"      // blocos empilhados, centralizado
  | "magazine"   // estilo editorial, com colunas
  | "poster"     // capa tipo cartaz, tipografia grande
  | "minimal"    // foco no texto, muito respiro
  | "card";      // cartão flutuante sobre fundo colorido

export type LandingTheme = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentFg: string;
};

export type LandingModel = {
  key: string;
  nome: string;
  descricao: string;
  layout: LandingLayout;
  fonte: "serif" | "sans";
  radius: string;
  theme: LandingTheme;
};

export const LANDING_MODELS: LandingModel[] = [
  {
    key: "aurora",
    nome: "Aurora",
    descricao: "Claro e elegante, imagem ao lado do conteúdo.",
    layout: "split",
    fonte: "serif",
    radius: "0.25rem",
    theme: {
      bg: "#faf9f6", surface: "#ffffff", fg: "#161513", muted: "#6b6863",
      border: "#e4e1da", accent: "#b8894b", accentFg: "#ffffff",
    },
  },
  {
    key: "meianoite",
    nome: "Meia-noite",
    descricao: "Fundo escuro sofisticado com destaque dourado.",
    layout: "split",
    fonte: "serif",
    radius: "0.25rem",
    theme: {
      bg: "#0e1116", surface: "#161b22", fg: "#f4f2ee", muted: "#9aa2ad",
      border: "#242c37", accent: "#d4ab45", accentFg: "#12151a",
    },
  },
  {
    key: "litoral",
    nome: "Litoral",
    descricao: "Azuis de praia com foto em destaque total.",
    layout: "overlay",
    fonte: "sans",
    radius: "1rem",
    theme: {
      bg: "#f2f8fb", surface: "#ffffff", fg: "#0d2b3a", muted: "#537285",
      border: "#d7e7f0", accent: "#0e7ea8", accentFg: "#ffffff",
    },
  },
  {
    key: "serra",
    nome: "Serra",
    descricao: "Verdes naturais, layout empilhado e acolhedor.",
    layout: "stack",
    fonte: "sans",
    radius: "0.75rem",
    theme: {
      bg: "#f5f7f2", surface: "#ffffff", fg: "#17251b", muted: "#5d6d60",
      border: "#dde5d8", accent: "#2f7d4f", accentFg: "#ffffff",
    },
  },
  {
    key: "editorial",
    nome: "Editorial",
    descricao: "Cara de revista de viagem, tipografia clássica.",
    layout: "magazine",
    fonte: "serif",
    radius: "0",
    theme: {
      bg: "#ffffff", surface: "#f7f6f4", fg: "#111111", muted: "#6a6a6a",
      border: "#e3e3e3", accent: "#111111", accentFg: "#ffffff",
    },
  },
  {
    key: "cartaz",
    nome: "Cartaz",
    descricao: "Impactante, tipografia gigante estilo pôster.",
    layout: "poster",
    fonte: "sans",
    radius: "0",
    theme: {
      bg: "#12100e", surface: "#1c1916", fg: "#fdfbf7", muted: "#a49b90",
      border: "#2c2822", accent: "#f0552b", accentFg: "#ffffff",
    },
  },
  {
    key: "areia",
    nome: "Areia",
    descricao: "Tons quentes de deserto, leitura confortável.",
    layout: "minimal",
    fonte: "serif",
    radius: "0.5rem",
    theme: {
      bg: "#fbf6ee", surface: "#ffffff", fg: "#2b2118", muted: "#7a6b5c",
      border: "#ece0cf", accent: "#c2703a", accentFg: "#ffffff",
    },
  },
  {
    key: "tropical",
    nome: "Tropical",
    descricao: "Cores vivas e alegres, cartão flutuante.",
    layout: "card",
    fonte: "sans",
    radius: "1.25rem",
    theme: {
      bg: "#0f3d33", surface: "#ffffff", fg: "#0d2b25", muted: "#5d7c74",
      border: "#d5e8e2", accent: "#f2a541", accentFg: "#123029",
    },
  },
  {
    key: "urbano",
    nome: "Urbano",
    descricao: "Cinzas modernos com acento elétrico.",
    layout: "split",
    fonte: "sans",
    radius: "0.5rem",
    theme: {
      bg: "#f4f5f7", surface: "#ffffff", fg: "#14161a", muted: "#666c75",
      border: "#e0e3e8", accent: "#2f5bea", accentFg: "#ffffff",
    },
  },
  {
    key: "vinho",
    nome: "Vinho",
    descricao: "Sofisticado em bordô, ideal para roteiros premium.",
    layout: "overlay",
    fonte: "serif",
    radius: "0.25rem",
    theme: {
      bg: "#1a0d12", surface: "#26141b", fg: "#f8eef0", muted: "#c0a0a8",
      border: "#3a1f28", accent: "#a3324c", accentFg: "#ffffff",
    },
  },
  {
    key: "neve",
    nome: "Neve",
    descricao: "Minimalista branco, foco total no texto.",
    layout: "minimal",
    fonte: "sans",
    radius: "0.25rem",
    theme: {
      bg: "#ffffff", surface: "#f6f7f9", fg: "#111318", muted: "#71767f",
      border: "#e6e8ec", accent: "#111318", accentFg: "#ffffff",
    },
  },
  {
    key: "safari",
    nome: "Safári",
    descricao: "Terroso e aventureiro, blocos empilhados.",
    layout: "stack",
    fonte: "serif",
    radius: "0.5rem",
    theme: {
      bg: "#f7f3e9", surface: "#ffffff", fg: "#2a2517", muted: "#7b7159",
      border: "#e6dcc4", accent: "#8a6d1f", accentFg: "#ffffff",
    },
  },
  {
    key: "cinema",
    nome: "Cinema",
    descricao: "Escuro e cinematográfico, foto em tela cheia.",
    layout: "overlay",
    fonte: "sans",
    radius: "0.375rem",
    theme: {
      bg: "#08090b", surface: "#131519", fg: "#f2f4f7", muted: "#969ba5",
      border: "#20242b", accent: "#e5c07b", accentFg: "#14161a",
    },
  },
  {
    key: "coral",
    nome: "Coral",
    descricao: "Suave e convidativo, cartão claro sobre cor.",
    layout: "card",
    fonte: "serif",
    radius: "1rem",
    theme: {
      bg: "#fde8e2", surface: "#ffffff", fg: "#3a1d18", muted: "#8b6459",
      border: "#f5d7cd", accent: "#e0603f", accentFg: "#ffffff",
    },
  },
  {
    key: "arquivo",
    nome: "Arquivo",
    descricao: "Editorial técnico, linhas finas e detalhes precisos.",
    layout: "magazine",
    fonte: "sans",
    radius: "0",
    theme: {
      bg: "#f2f1ed", surface: "#ffffff", fg: "#1a1a18", muted: "#6d6d66",
      border: "#dcdad2", accent: "#3f6f4e", accentFg: "#ffffff",
    },
  },
];

export const DEFAULT_LANDING_MODEL = "aurora";

export function getLandingModel(key: string | null | undefined): LandingModel {
  return (
    LANDING_MODELS.find((m) => m.key === key) ??
    LANDING_MODELS.find((m) => m.key === DEFAULT_LANDING_MODEL)!
  );
}

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
