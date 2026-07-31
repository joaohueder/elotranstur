import { useState } from "react";
import { AlertOctagon, AlertTriangle, Camera, CheckCircle2, Copy } from "lucide-react";

import { HintButton } from "@/components/help";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FeedbackState } from "@/lib/feedback";

type Props = {
  state: FeedbackState | null;
  onClose: () => void;
};

const ICONS = {
  success: CheckCircle2,
  negative: AlertTriangle,
  error: AlertOctagon,
} as const;

const TONES = {
  success: {
    badge: "bg-emerald-600/10 text-emerald-600",
    bar: "bg-emerald-600",
  },
  negative: {
    badge: "bg-destructive/10 text-destructive",
    bar: "bg-destructive",
  },
  error: {
    badge: "bg-destructive/10 text-destructive",
    bar: "bg-destructive",
  },
} as const;

export function FeedbackModal({ state, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const open = state !== null;
  const kind = state?.kind ?? "success";
  const Icon = ICONS[kind];
  const tone = TONES[kind];
  const isError = kind === "error";

  const handleCopy = async () => {
    if (!state?.originalError) return;
    try {
      await navigator.clipboard.writeText(state.originalError);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleScreenshot = async () => {
    setCapturing(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(document.body, {
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `elo-erro-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-none border-border p-0 sm:max-w-[34rem]">
        <div className={`h-1 w-full ${tone.bar}`} aria-hidden />

        <DialogHeader className="space-y-0 px-6 pb-4 pt-6 text-left">
          <div className="flex items-start gap-4 pr-8">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone.badge}`}
              aria-hidden
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="font-serif text-xl leading-snug tracking-tight text-foreground">
                {state?.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {state?.message}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isError && state?.originalError && (
          <div className="border-t border-border bg-muted/40 px-6 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Erro original
            </p>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {state.originalError}
            </pre>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-border bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {isError ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <HintButton
                hint="Salva uma imagem desta tela para você enviar ao suporte"
                type="button"
                variant="outline"
                size="sm"
                className="h-9 justify-center rounded-none text-xs font-medium"
                onClick={handleScreenshot}
                disabled={capturing}
              >
                <Camera className="mr-2 h-3.5 w-3.5" />
                {capturing ? "Capturando..." : "Print screen"}
              </HintButton>
              <HintButton
                hint="Copia o texto técnico do erro para colar e enviar ao suporte"
                type="button"
                variant="outline"
                size="sm"
                className="h-9 justify-center rounded-none text-xs font-medium"
                onClick={handleCopy}
                disabled={!state?.originalError}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                {copied ? "Copiado!" : "Copiar erro original"}
              </HintButton>
            </div>
          ) : (
            <span className="hidden sm:block" />
          )}

          <HintButton
            hint="Fecha esta mensagem e volta para a tela"
            type="button"
            size="sm"
            className="h-9 rounded-none px-8 text-xs font-semibold uppercase tracking-widest"
            onClick={onClose}
          >
            Fechar
          </HintButton>

        </div>
      </DialogContent>
    </Dialog>
  );
}
