export const VIAGEM_SITUACOES = [
  { key: "rascunho", label: "Rascunho" },
  { key: "ativa", label: "Ativa" },
  { key: "fechada", label: "Fechada" },
  { key: "concluida", label: "Concluída" },
  { key: "cancelada", label: "Cancelada" },
] as const;

export type ViagemSituacao = (typeof VIAGEM_SITUACOES)[number]["key"];

export type ViagemImagem = {
  url: string;
  path: string;
  capa?: boolean;
};

export type Viagem = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  descricao: string | null;
  destino: string;
  data_partida: string;
  hora_partida: string | null;
  valor: number;
  vagas: number;
  itens_inclusos: string[];
  imagens: ViagemImagem[];
  situacao: ViagemSituacao;
  created_at: string;
  landing_slug?: string | null;
  landing_ativa?: boolean | null;
};


/** Retorna a URL da foto de capa da galeria (ou a primeira imagem). */
export function capaDa(imagens: ViagemImagem[] | null | undefined): string | null {
  const lista = imagens ?? [];
  return (lista.find((i) => i.capa) ?? lista[0])?.url ?? null;
}

/** Formata "HH:MM:SS" como "HH:MM". */
export function formatarHora(hora: string | null | undefined): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}


/** Formata um número como moeda brasileira. */
export function formatarValor(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

/** Máscara de moeda a partir dos dígitos digitados. */
export function maskValor(entrada: string): string {
  const digitos = entrada.replace(/\D/g, "").slice(0, 11);
  if (!digitos) return "";
  const numero = Number(digitos) / 100;
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte a máscara de moeda em número. */
export function parseValor(mascara: string): number {
  const digitos = mascara.replace(/\D/g, "");
  return digitos ? Number(digitos) / 100 : 0;
}

export function situacaoLabel(s: ViagemSituacao): string {
  return VIAGEM_SITUACOES.find((v) => v.key === s)?.label ?? s;
}

/** Classes do badge de situação (tokens semânticos do tema). */
export function situacaoClasses(s: ViagemSituacao): string {
  switch (s) {
    case "ativa":
      return "border-brand-accent/40 bg-brand-accent/10 text-brand-accent";
    case "fechada":
      return "border-primary/30 bg-primary/10 text-primary";
    case "concluida":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
    case "cancelada":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function formatarData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
