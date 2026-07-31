import { useState, type ComponentProps, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Ícone de ajuda com explicação curta e para leigos.
 * Abre no hover (desktop) e no toque/clique (mobile).
 */
export function HelpTip({
  texto,
  className,
}: {
  texto: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Tooltip open={aberto} onOpenChange={setAberto}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Ajuda: ${texto}`}
          onClick={(e) => {
            e.preventDefault();
            setAberto((v) => !v);
          }}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {texto}
      </TooltipContent>
    </Tooltip>
  );
}

/** Rótulo de campo já acompanhado do ícone de ajuda. */
export function FieldLabel({
  children,
  help,
  className,
  ...props
}: ComponentProps<typeof Label> & { help: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className={className} {...props}>
        {children}
      </Label>
      <HelpTip texto={help} />
    </div>
  );
}

/** Botão padrão do sistema com hint explicando o que faz. */
export function HintButton({
  hint,
  children,
  ...props
}: ComponentProps<typeof Button> & { hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={props["aria-label"] ?? hint} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

/** Cabeçalho de seção com ícone de ajuda ao lado do título. */
export function SectionTitle({
  titulo,
  help,
  className,
}: {
  titulo: string;
  help: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {titulo}
      </span>
      <HelpTip texto={help} />
    </div>
  );
}
