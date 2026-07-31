export const VIAGEM_SITUACOES = [
  { key: "rascunho", label: "Rascunho" },
  { key: "ativa", label: "Ativa" },
  { key: "fechada", label: "Fechada" },
  { key: "concluida", label: "Concluída" },
  { key: "cancelada", label: "Cancelada" },
] as const;

export type ViagemSituacao = (typeof VIAGEM_SITUACOES)[number]["key"];

export type Viagem = {
  id: string;
  destino: string;
  data_partida: string;
  itens_inclusos: string[];
  situacao: ViagemSituacao;
  created_at: string;
};

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
