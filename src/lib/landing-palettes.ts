/**
 * Paletas de cores das landing pages.
 *
 * A paleta é escolhida separadamente do modelo: qualquer um dos 15 modelos
 * pode ser combinado com qualquer uma das 15 paletas abaixo.
 */

export type LandingPalette = {
  key: string;
  nome: string;
  descricao: string;
  /** Fundo geral da página */
  bg: string;
  /** Fundo de cartões, caixas e formulário */
  surface: string;
  /** Cor do texto principal */
  fg: string;
  /** Cor de textos secundários */
  muted: string;
  /** Cor de linhas e bordas */
  border: string;
  /** Cor principal de destaque (botões, preço) */
  accent: string;
  /** Cor secundária de destaque (gradientes, detalhes) */
  accent2: string;
  /** Cor do texto sobre o destaque */
  accentFg: string;
  /** Indica se a paleta é escura (ajusta sombras e transparências) */
  escura: boolean;
};

export const LANDING_PALETTES: LandingPalette[] = [
  {
    key: "areia-dourada", nome: "Areia Dourada", descricao: "Bege quente com dourado elegante.",
    bg: "#faf7f1", surface: "#ffffff", fg: "#191510", muted: "#736a5c",
    border: "#e8e0d2", accent: "#b8894b", accent2: "#e0b568", accentFg: "#ffffff", escura: false,
  },
  {
    key: "meia-noite", nome: "Meia-Noite", descricao: "Preto azulado com dourado premium.",
    bg: "#0d1117", surface: "#161c25", fg: "#f4f2ee", muted: "#98a2b0",
    border: "#252d38", accent: "#d4ab45", accent2: "#f0d288", accentFg: "#12151a", escura: true,
  },
  {
    key: "oceano", nome: "Oceano", descricao: "Azuis profundos de praia e mar.",
    bg: "#f1f8fb", surface: "#ffffff", fg: "#0b2b3a", muted: "#517084",
    border: "#d5e6ef", accent: "#0e7ea8", accent2: "#38c0dc", accentFg: "#ffffff", escura: false,
  },
  {
    key: "floresta", nome: "Floresta", descricao: "Verdes naturais e acolhedores.",
    bg: "#f4f7f2", surface: "#ffffff", fg: "#12231a", muted: "#5b6d60",
    border: "#dbe4d6", accent: "#2f7d4f", accent2: "#71c48b", accentFg: "#ffffff", escura: false,
  },
  {
    key: "por-do-sol", nome: "Pôr do Sol", descricao: "Laranja e rosa vibrantes, alta energia.",
    bg: "#fff6f1", surface: "#ffffff", fg: "#2c130c", muted: "#8a6154",
    border: "#f7ded1", accent: "#ef5f2b", accent2: "#f7a13c", accentFg: "#ffffff", escura: false,
  },
  {
    key: "vinho", nome: "Vinho", descricao: "Bordô sofisticado para roteiros premium.",
    bg: "#190b10", surface: "#26141b", fg: "#f8eef0", muted: "#c09fa8",
    border: "#3a1f28", accent: "#b23a56", accent2: "#e0748c", accentFg: "#ffffff", escura: true,
  },
  {
    key: "grafite", nome: "Grafite", descricao: "Cinzas modernos com azul elétrico.",
    bg: "#f4f5f7", surface: "#ffffff", fg: "#12141a", muted: "#666c75",
    border: "#e0e3e8", accent: "#2f5bea", accent2: "#6f92ff", accentFg: "#ffffff", escura: false,
  },
  {
    key: "tropical", nome: "Tropical", descricao: "Turquesa e manga, clima de férias.",
    bg: "#f0fbf7", surface: "#ffffff", fg: "#0b2b25", muted: "#537d73",
    border: "#cfeae1", accent: "#0fa17f", accent2: "#f2a541", accentFg: "#ffffff", escura: false,
  },
  {
    key: "neve", nome: "Neve", descricao: "Branco minimalista, contraste puro.",
    bg: "#ffffff", surface: "#f6f7f9", fg: "#111318", muted: "#71767f",
    border: "#e6e8ec", accent: "#111318", accent2: "#4b5563", accentFg: "#ffffff", escura: false,
  },
  {
    key: "carvao", nome: "Carvão", descricao: "Escuro neutro com verde-limão.",
    bg: "#0b0c0e", surface: "#15171b", fg: "#f2f4f7", muted: "#949aa4",
    border: "#22262d", accent: "#c6f24e", accent2: "#8fd93a", accentFg: "#101317", escura: true,
  },
  {
    key: "lavanda", nome: "Lavanda", descricao: "Roxo suave e delicado.",
    bg: "#f8f5ff", surface: "#ffffff", fg: "#1d1430", muted: "#6f6489",
    border: "#e5ddf6", accent: "#7c4dff", accent2: "#b18cff", accentFg: "#ffffff", escura: false,
  },
  {
    key: "terracota", nome: "Terracota", descricao: "Barro e argila, aconchegante.",
    bg: "#fbf4ef", surface: "#ffffff", fg: "#2b1a12", muted: "#7c6455",
    border: "#eddcd0", accent: "#c2703a", accent2: "#e0a06c", accentFg: "#ffffff", escura: false,
  },
  {
    key: "cafe", nome: "Café", descricao: "Marrom escuro com creme.",
    bg: "#17120e", surface: "#221a14", fg: "#f6efe6", muted: "#b6a595",
    border: "#33281f", accent: "#d9a441", accent2: "#f0cd8a", accentFg: "#1a1410", escura: true,
  },
  {
    key: "coral", nome: "Coral", descricao: "Rosa-coral leve e convidativo.",
    bg: "#fff3f0", surface: "#ffffff", fg: "#391914", muted: "#8b6459",
    border: "#f8dcd4", accent: "#e0603f", accent2: "#ff9478", accentFg: "#ffffff", escura: false,
  },
  {
    key: "azul-noturno", nome: "Azul Noturno", descricao: "Marinho profundo com ciano brilhante.",
    bg: "#08101d", surface: "#101c2e", fg: "#eef4fb", muted: "#8fa3bd",
    border: "#1d2c42", accent: "#2ec5ff", accent2: "#6f7dff", accentFg: "#07131f", escura: true,
  },
];

export const DEFAULT_LANDING_PALETTE = "areia-dourada";

export function getLandingPalette(key: string | null | undefined): LandingPalette {
  return (
    LANDING_PALETTES.find((p) => p.key === key) ??
    LANDING_PALETTES.find((p) => p.key === DEFAULT_LANDING_PALETTE)!
  );
}
