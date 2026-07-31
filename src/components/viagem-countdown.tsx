import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

import { HelpTip } from "@/components/help";
import { cn } from "@/lib/utils";

/** Calcula a diferença em anos, meses, dias, horas e minutos. */
function diferenca(alvo: Date, agora: Date) {
  let anos = alvo.getFullYear() - agora.getFullYear();
  let meses = alvo.getMonth() - agora.getMonth();
  let dias = alvo.getDate() - agora.getDate();
  let horas = alvo.getHours() - agora.getHours();
  let minutos = alvo.getMinutes() - agora.getMinutes();

  if (minutos < 0) {
    minutos += 60;
    horas -= 1;
  }
  if (horas < 0) {
    horas += 24;
    dias -= 1;
  }
  if (dias < 0) {
    const ultimoDiaMesAnterior = new Date(
      alvo.getFullYear(),
      alvo.getMonth(),
      0,
    ).getDate();
    dias += ultimoDiaMesAnterior;
    meses -= 1;
  }
  if (meses < 0) {
    meses += 12;
    anos -= 1;
  }
  return { anos, meses, dias, horas, minutos };
}

function plural(n: number, singular: string, plural_: string) {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function partidaEm(data: string, hora: string | null | undefined) {
  const [a, m, d] = data.split("-").map(Number);
  const [hh = 0, mm = 0] = (hora ?? "00:00").split(":").map(Number);
  return new Date(a, (m || 1) - 1, d || 1, hh, mm, 0, 0);
}

type Props = {
  data: string;
  hora?: string | null;
  className?: string;
};

/** Contagem regressiva destacada até a partida da viagem. */
export function ViagemCountdown({ data, hora, className }: Props) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const alvo = partidaEm(data, hora);
  const passou = alvo.getTime() <= agora.getTime();

  if (passou) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-3 py-2",
          className,
        )}
      >
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Partida realizada
        </span>
      </div>
    );
  }

  const { anos, meses, dias, horas, minutos } = diferenca(alvo, agora);
  const partes: string[] = [];
  if (anos > 0) partes.push(plural(anos, "ano", "anos"));
  if (meses > 0) partes.push(plural(meses, "mês", "meses"));
  if (dias > 0) partes.push(plural(dias, "dia", "dias"));
  if (horas > 0) partes.push(plural(horas, "hora", "horas"));
  if (minutos > 0 || partes.length === 0)
    partes.push(plural(minutos, "minuto", "minutos"));

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 shadow-sm",
        className,
      )}
    >
      <CalendarClock className="h-4 w-4 shrink-0 text-brand-accent" />
      <div className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Faltam
        </span>
        <span className="block text-sm font-semibold text-brand-accent">
          {partes.slice(0, 3).join(", ")}
        </span>
      </div>
      <HelpTip texto="Tempo restante até a data e hora de partida desta viagem. Atualiza sozinho." />
    </div>
  );
}
