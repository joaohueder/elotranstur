import { useState } from "react";
import { AlertOctagon, AlertTriangle, Camera, CheckCircle2, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  success: "text-emerald-600",
  negative: "text-destructive",
  error: "text-destructive",
} as const;

export function FeedbackModal({ state, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const open = state !== null;
  const kind = state?.kind ?? "success";
  const Icon = ICONS[kind];

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
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <div className={`mb-2 flex items-center gap-3 ${TONES[kind]}`}>
            <Icon className="h-8 w-8" aria-hidden />
            <DialogTitle className="font-serif text-2xl">
              {state?.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-foreground/80">
            {state?.message}
          </DialogDescription>
        </DialogHeader>

        {kind === "error" && state?.originalError && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Erro original
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border border-border bg-muted p-3 text-xs text-muted-foreground">
              {state.originalError}
            </pre>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {kind === "error" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={handleScreenshot}
                disabled={capturing}
              >
                <Camera className="mr-2 h-4 w-4" />
                {capturing ? "Capturando..." : "Print screen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={handleCopy}
                disabled={!state?.originalError}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copiado!" : "Copiar erro original"}
              </Button>
            </div>
          ) : (
            <span />
          )}
          <Button type="button" className="rounded-none" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
