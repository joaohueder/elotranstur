import { AlertTriangle } from "lucide-react";

import { HintButton } from "@/components/help";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const isDestructive = variant === "destructive";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="gap-0 overflow-hidden rounded-none border-border p-0 sm:max-w-[28rem]">
        <div
          className={`h-1 w-full ${isDestructive ? "bg-destructive" : "bg-primary"}`}
          aria-hidden
        />

        <DialogHeader className="space-y-0 px-6 pb-4 pt-6 text-left">
          <div className="flex items-start gap-4 pr-8">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                isDestructive
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
              aria-hidden
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="font-serif text-xl leading-snug tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {message}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col-reverse gap-3 border-t border-border bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <HintButton
            type="button"
            variant="outline"
            hint="Cancela a ação e volta para a tela"
            className="h-9 rounded-none px-6 text-xs font-semibold uppercase tracking-widest"
            onClick={onCancel}
          >
            {cancelText}
          </HintButton>
          <HintButton
            type="button"
            hint="Confirma a ação solicitada"
            className={`h-9 rounded-none px-6 text-xs font-semibold uppercase tracking-widest ${
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </HintButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
