/**
 * Paletas de cores das landing pages.
 *
 * Cores selecionadas com base no que agências de turismo de alta conversão
 * vêm usando: tons naturais (areia, oceano, floresta), contrastes suaves e
 * um destaque quente para o botão de ação.
 */

export type LandingPalette = {
  key: string;
  nome: string;
  descricao: string;
  /** Fundo geral da página */
  bg: string;
  /** Fundo alternado de seções */
  bg2: string;
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
    key: "areia-dourada",
    nome: "Areia",
    descricao: "Areia quente com âmbar tostado. Clima de litoral sofisticado.",
    bg: "#fbf8f4", bg2: "#f4eee5", surface: "#ffffff", fg: "#1c1917",
    muted: "#78716c", border: "#e7ded1", accent: "#c2683a", accent2: "#e9a13b",
    accentFg: "#ffffff", escura: false,
  },
  {
    key: "oceano",
    nome: "Oceano",
    descricao: "Azul-petróleo profundo com turquesa. Mar, praia e confiança.",
    bg: "#f5faf9", bg2: "#e6f2f1", surface: "#ffffff", fg: "#0b2b2c",
    muted: "#5b7c7d", border: "#d5e7e6", accent: "#0d7d78", accent2: "#3fc0b3",
    accentFg: "#ffffff", escura: false,
  },
  {
    key: "por-do-sol",
    nome: "Pôr do Sol",
    descricao: "Coral e tangerina vibrantes. Alta energia para anúncios.",
    bg: "#fff8f4", bg2: "#ffeee5", surface: "#ffffff", fg: "#2b1509",
    muted: "#8a6250", border: "#fadfd0", accent: "#e2563c", accent2: "#fb923c",
    accentFg: "#ffffff", escura: false,
  },
  {
    key: "floresta",
    nome: "Floresta",
    descricao: "Verde-oliva e sálvia. Ecoturismo, natureza e serra.",
    bg: "#f7f9f4", bg2: "#eaf0e3", surface: "#ffffff", fg: "#16211a",
    muted: "#5f7263", border: "#dde6d5", accent: "#3f7d4e", accent2: "#8fbc55",
    accentFg: "#ffffff", escura: false,
  },
  {
    key: "neve",
    nome: "Neve",
    descricao: "Off-white minimalista com preto suave. Elegante e neutro.",
    bg: "#fafaf9", bg2: "#f2f2f0", surface: "#ffffff", fg: "#111110",
    muted: "#6f6f6b", border: "#e6e6e2", accent: "#1c1c1a", accent2: "#57534e",
    accentFg: "#ffffff", escura: false,
  },
  {
    key: "meia-noite",
    nome: "Meia-Noite",
    descricao: "Grafite azulado com âmbar. Premium, viagens exclusivas.",
    bg: "#0e1116", bg2: "#141922", surface: "#181e28", fg: "#f4f4f2",
    muted: "#9aa4b2", border: "#252d3a", accent: "#e8a33d", accent2: "#f6cf7c",
    accentFg: "#14171d", escura: true,
  },
  {
    key: "azul-noturno",
    nome: "Azul Noturno",
    descricao: "Marinho profundo com ciano. Cruzeiros e viagens noturnas.",
    bg: "#07121f", bg2: "#0c1a2b", surface: "#101f33", fg: "#eef4fb",
    muted: "#8fa5c0", border: "#1c2f47", accent: "#31c4d6", accent2: "#6f8bff",
    accentFg: "#061420", escura: true,
  },
  {
    key: "terracota",
    nome: "Terracota",
    descricao: "Barro, argila e rosa queimado. Cultura, interior e história.",
    bg: "#fbf6f2", bg2: "#f3e8e0", surface: "#ffffff", fg: "#2a1a14",
    muted: "#7d6357", border: "#ecdccf", accent: "#a8563f", accent2: "#d99268",
    accentFg: "#ffffff", escura: false,
  },
];

export const DEFAULT_LANDING_PALETTE = "areia-dourada";

export function getLandingPalette(key: string | null | undefined): LandingPalette {
  return (
    LANDING_PALETTES.find((p) => p.key === key) ??
    LANDING_PALETTES.find((p) => p.key === DEFAULT_LANDING_PALETTE)!
  );
}
