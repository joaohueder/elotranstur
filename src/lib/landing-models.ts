/**
 * Modelos visuais de landing page das viagens.
 *
 * Cada modelo define uma estrutura própria (hero, ordem das seções, posição do
 * formulário), sua própria tipografia, seu conjunto de ícones e o seu estilo de
 * botões/cartões. A COR não faz parte do modelo: ela vem da paleta escolhida
 * separadamente (ver `landing-palettes.ts`).
 */

import { DEFAULT_LANDING_PALETTE } from "./landing-palettes";

/** Estrutura visual principal (cada modelo tem a sua). */
export type LandingHero =
  | "split"        // slider à esquerda, conteúdo e formulário à direita
  | "fullbleed"    // slider ocupando a tela toda com texto sobreposto
  | "diagonal"     // faixa diagonal cortando a foto
  | "magazine"     // editorial, manchete em colunas
  | "poster"       // tipografia gigante tipo cartaz
  | "ticket"       // formato bilhete/boarding pass
  | "cardfloat"    // cartão flutuante sobre cor sólida
  | "centered"     // centralizado minimalista
  | "collage"      // mosaico de fotos
  | "banner"       // faixa horizontal compacta, CTA imediato
  | "framed"       // moldura fina, ar de convite
  | "spotlight"    // holofote radial sobre a foto
  | "layered"      // camadas sobrepostas com deslocamento
  | "story"        // formato vertical estilo stories
  | "grid";        // grade modular tipo painel

/** Como o formulário de lead é posicionado. */
export type LandingFormPos = "lado" | "abaixo" | "hero" | "flutuante";

/** Estilo dos blocos de informação. */
export type LandingBlocos = "cartoes" | "linhas" | "pilulas" | "faixa" | "grade";

/** Estilo do botão principal. */
export type LandingCta = "solido" | "gradiente" | "contorno" | "brilho" | "bloco";

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
  blocos: LandingBlocos;
  cta: LandingCta;
  ctaLabel: string;
  /** Conjunto de ícones usado nas informações */
  icones: "classico" | "viagem" | "geometrico" | "bussola" | "bilhete";
  formPos: LandingFormPos;
  /** Mostra contagem regressiva de urgência */
  countdown: boolean;
  /** Mostra selo de prova social / escassez */
  escassez: boolean;
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
    descricao: "Clássico de alta conversão: slider ao lado do formulário, sempre visível.",
    hero: "split",
    fonts: f("'Playfair Display', serif", "'Inter', sans-serif", "Playfair+Display:wght@500;700&family=Inter:wght@400;500;600"),
    caixaAlta: false, tracking: "-0.02em", peso: 700, radius: "0.5rem",
    blocos: "cartoes", cta: "solido", ctaLabel: "Quero garantir minha vaga",
    icones: "classico", formPos: "lado", countdown: true, escassez: true,
    paletaPadrao: "areia-dourada",
  },
  {
    key: "impacto",
    nome: "Impacto",
    descricao: "Foto em tela cheia, manchete gigante e CTA logo no primeiro olhar.",
    hero: "fullbleed",
    fonts: f("'Bebas Neue', sans-serif", "'Barlow', sans-serif", "Bebas+Neue&family=Barlow:wght@400;500;600"),
    caixaAlta: true, tracking: "0.02em", peso: 400, radius: "0.25rem",
    blocos: "faixa", cta: "gradiente", ctaLabel: "Reservar agora",
    icones: "viagem", formPos: "hero", countdown: true, escassez: true,
    paletaPadrao: "meia-noite",
  },
  {
    key: "diagonal",
    nome: "Diagonal",
    descricao: "Corte diagonal dinâmico, sensação de movimento e velocidade.",
    hero: "diagonal",
    fonts: f("'Space Grotesk', sans-serif", "'DM Sans', sans-serif", "Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;500;700"),
    caixaAlta: false, tracking: "-0.03em", peso: 700, radius: "0.75rem",
    blocos: "pilulas", cta: "brilho", ctaLabel: "Quero embarcar",
    icones: "geometrico", formPos: "lado", countdown: true, escassez: false,
    paletaPadrao: "oceano",
  },
  {
    key: "editorial",
    nome: "Editorial",
    descricao: "Cara de revista de viagem: manchete, colunas e muito respiro.",
    hero: "magazine",
    fonts: f("'Cormorant Garamond', serif", "'Karla', sans-serif", "Cormorant+Garamond:wght@500;600;700&family=Karla:wght@400;500;700"),
    caixaAlta: false, tracking: "-0.01em", peso: 600, radius: "0",
    blocos: "linhas", cta: "contorno", ctaLabel: "Solicitar roteiro completo",
    icones: "classico", formPos: "lado", countdown: false, escassez: false,
    paletaPadrao: "neve",
  },
  {
    key: "cartaz",
    nome: "Cartaz",
    descricao: "Tipografia colossal estilo pôster de cinema. Ideal para anúncios.",
    hero: "poster",
    fonts: f("'Archivo Black', sans-serif", "'Archivo', sans-serif", "Archivo+Black&family=Archivo:wght@400;500;600"),
    caixaAlta: true, tracking: "-0.03em", peso: 400, radius: "0",
    blocos: "grade", cta: "bloco", ctaLabel: "Quero ir",
    icones: "geometrico", formPos: "abaixo", countdown: true, escassez: true,
    paletaPadrao: "carvao",
  },
  {
    key: "bilhete",
    nome: "Bilhete",
    descricao: "Formato de passagem de embarque, lúdico e memorável.",
    hero: "ticket",
    fonts: f("'JetBrains Mono', monospace", "'Work Sans', sans-serif", "JetBrains+Mono:wght@500;700&family=Work+Sans:wght@400;500;600"),
    caixaAlta: true, tracking: "0.08em", peso: 700, radius: "0.5rem",
    blocos: "linhas", cta: "solido", ctaLabel: "Emitir minha reserva",
    icones: "bilhete", formPos: "abaixo", countdown: true, escassez: true,
    paletaPadrao: "grafite",
  },
  {
    key: "flutuante",
    nome: "Flutuante",
    descricao: "Cartão elevado sobre fundo colorido, leve e premium.",
    hero: "cardfloat",
    fonts: f("'Syne', sans-serif", "'Manrope', sans-serif", "Syne:wght@600;800&family=Manrope:wght@400;500;700"),
    caixaAlta: false, tracking: "-0.02em", peso: 800, radius: "1.5rem",
    blocos: "cartoes", cta: "gradiente", ctaLabel: "Falar com um consultor",
    icones: "viagem", formPos: "abaixo", countdown: false, escassez: true,
    paletaPadrao: "tropical",
  },
  {
    key: "sereno",
    nome: "Sereno",
    descricao: "Centralizado e minimalista, foco total na oferta.",
    hero: "centered",
    fonts: f("'DM Serif Display', serif", "'Work Sans', sans-serif", "DM+Serif+Display&family=Work+Sans:wght@400;500;600"),
    caixaAlta: false, tracking: "-0.01em", peso: 400, radius: "0.375rem",
    blocos: "linhas", cta: "solido", ctaLabel: "Quero saber mais",
    icones: "classico", formPos: "abaixo", countdown: false, escassez: false,
    paletaPadrao: "lavanda",
  },
  {
    key: "mosaico",
    nome: "Mosaico",
    descricao: "Colagem de fotos no topo: mostra o destino de vários ângulos.",
    hero: "collage",
    fonts: f("'Outfit', sans-serif", "'Figtree', sans-serif", "Outfit:wght@500;700&family=Figtree:wght@400;500;600"),
    caixaAlta: false, tracking: "-0.02em", peso: 700, radius: "1rem",
    blocos: "grade", cta: "solido", ctaLabel: "Quero conhecer",
    icones: "viagem", formPos: "lado", countdown: true, escassez: false,
    paletaPadrao: "por-do-sol",
  },
  {
    key: "expresso",
    nome: "Expresso",
    descricao: "Faixa compacta com CTA imediato: página curta e direta ao ponto.",
    hero: "banner",
    fonts: f("'Anton', sans-serif", "'Roboto', sans-serif", "Anton&family=Roboto:wght@400;500;700"),
    caixaAlta: true, tracking: "0.01em", peso: 400, radius: "0.25rem",
    blocos: "pilulas", cta: "bloco", ctaLabel: "Chamar no WhatsApp",
    icones: "geometrico", formPos: "hero", countdown: true, escassez: true,
    paletaPadrao: "por-do-sol",
  },
  {
    key: "convite",
    nome: "Convite",
    descricao: "Moldura fina e tipografia clássica: parece um convite impresso.",
    hero: "framed",
    fonts: f("'Libre Baskerville', serif", "'IBM Plex Sans', sans-serif", "Libre+Baskerville:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600"),
    caixaAlta: false, tracking: "0.02em", peso: 700, radius: "0",
    blocos: "linhas", cta: "contorno", ctaLabel: "Confirmar interesse",
    icones: "classico", formPos: "abaixo", countdown: false, escassez: false,
    paletaPadrao: "vinho",
  },
  {
    key: "holofote",
    nome: "Holofote",
    descricao: "Luz radial sobre a foto, clima cinematográfico e premium.",
    hero: "spotlight",
    fonts: f("'Sora', sans-serif", "'Manrope', sans-serif", "Sora:wght@500;700&family=Manrope:wght@400;500;700"),
    caixaAlta: false, tracking: "-0.02em", peso: 700, radius: "0.75rem",
    blocos: "cartoes", cta: "brilho", ctaLabel: "Garantir minha vaga",
    icones: "bussola", formPos: "hero", countdown: true, escassez: true,
    paletaPadrao: "azul-noturno",
  },
  {
    key: "camadas",
    nome: "Camadas",
    descricao: "Blocos sobrepostos e deslocados, com ar de estúdio de design.",
    hero: "layered",
    fonts: f("'Fraunces', serif", "'Nunito Sans', sans-serif", "Fraunces:opsz,wght@9..144,600;9..144,700&family=Nunito+Sans:wght@400;500;700"),
    caixaAlta: false, tracking: "-0.02em", peso: 700, radius: "1rem",
    blocos: "cartoes", cta: "gradiente", ctaLabel: "Quero os detalhes",
    icones: "viagem", formPos: "lado", countdown: false, escassez: true,
    paletaPadrao: "terracota",
  },
  {
    key: "stories",
    nome: "Stories",
    descricao: "Vertical como um story: pensado para tráfego vindo do celular.",
    hero: "story",
    fonts: f("'Urbanist', sans-serif", "'Epilogue', sans-serif", "Urbanist:wght@600;800&family=Epilogue:wght@400;500;600"),
    caixaAlta: true, tracking: "0.04em", peso: 800, radius: "1.25rem",
    blocos: "pilulas", cta: "gradiente", ctaLabel: "Quero minha vaga",
    icones: "geometrico", formPos: "flutuante", countdown: true, escassez: true,
    paletaPadrao: "coral",
  },
  {
    key: "painel",
    nome: "Painel",
    descricao: "Grade modular com todos os dados à mostra, transmite segurança.",
    hero: "grid",
    fonts: f("'Space Grotesk', sans-serif", "'IBM Plex Sans', sans-serif", "Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600"),
    caixaAlta: false, tracking: "-0.01em", peso: 700, radius: "0.5rem",
    blocos: "grade", cta: "solido", ctaLabel: "Solicitar proposta",
    icones: "bussola", formPos: "lado", countdown: true, escassez: false,
    paletaPadrao: "cafe",
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
