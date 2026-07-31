import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata quanto tempo falta até uma data/hora em dias, horas, minutos e segundos. */
export function formatarTempoRestante(
  expiraEm: string | number | Date | null,
  agora: number = Date.now(),
): string {
  if (!expiraEm) return "—";
  const fim = new Date(expiraEm).getTime();
  if (Number.isNaN(fim)) return "—";
  let restante = Math.max(0, fim - agora);
  if (restante === 0) return "Expirado";

  const dias = Math.floor(restante / (24 * 60 * 60 * 1000));
  restante %= 24 * 60 * 60 * 1000;
  const horas = Math.floor(restante / (60 * 60 * 1000));
  restante %= 60 * 60 * 1000;
  const minutos = Math.floor(restante / (60 * 1000));
  restante %= 60 * 1000;
  const segundos = Math.floor(restante / 1000);

  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0 || partes.length > 0) partes.push(`${horas}h`);
  if (minutos > 0 || partes.length > 0) partes.push(`${minutos}m`);
  partes.push(`${segundos}s`);

  return partes.join(" ");
}
