import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { FeedbackModal } from "@/components/feedback-modal";

/**
 * Padrão obrigatório do sistema ELO:
 * - Mensagens positivas  -> modal de sucesso (ícone de sucesso).
 * - Mensagens negativas  -> modal de erro (ícone de erro).
 * - Mensagens de erro    -> modal de erro crítico, com descrição amigável,
 *   erro original, botão de print screen e botão para copiar o erro original.
 *
 * Nenhuma tela deve usar toast/alert inline para esses casos.
 */

export type FeedbackKind = "success" | "negative" | "error";

export type FeedbackState = {
  kind: FeedbackKind;
  title: string;
  /** Mensagem amigável para o usuário final. */
  message: string;
  /** Texto técnico original (somente para kind === "error"). */
  originalError?: string;
};

type FeedbackContextValue = {
  showSuccess: (title: string, message: string) => void;
  showNegative: (title: string, message: string) => void;
  showError: (title: string, message: string, original?: unknown) => void;
  close: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function serializeError(original: unknown): string {
  if (original === undefined || original === null) return "";
  if (typeof original === "string") return original;
  if (original instanceof Error) {
    return [
      `name: ${original.name}`,
      `message: ${original.message}`,
      original.stack ? `stack:\n${original.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  try {
    return JSON.stringify(original, Object.getOwnPropertyNames(Object(original)), 2);
  } catch {
    return String(original);
  }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeedbackState | null>(null);

  const close = useCallback(() => setState(null), []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      close,
      showSuccess: (title, message) =>
        setState({ kind: "success", title, message }),
      showNegative: (title, message) =>
        setState({ kind: "negative", title, message }),
      showError: (title, message, original) =>
        setState({
          kind: "error",
          title,
          message,
          originalError: serializeError(original),
        }),
    }),
    [close],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackModal state={state} onClose={close} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback precisa estar dentro de <FeedbackProvider>.");
  }
  return ctx;
}
