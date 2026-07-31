import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ConfirmModal } from "@/components/confirm-modal";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback(
    (value: boolean) => {
      state?.resolve(value);
      setState(null);
    },
    [state],
  );

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmModal
        open={state !== null}
        title={state?.title ?? ""}
        message={state?.message ?? ""}
        confirmText={state?.confirmText}
        cancelText={state?.cancelText}
        variant={state?.variant}
        onConfirm={() => handleClose(true)}
        onCancel={() => handleClose(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>.");
  }
  return ctx;
}
