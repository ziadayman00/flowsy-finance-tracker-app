import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastMessage } from '../components/primitives/Toast';

interface ToastContextValue {
  showToast: (
    message: string,
    action?: {
      label: string;
      onAction: () => void;
      durationMs?: number;
    }
  ) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (
      message: string,
      action?: {
        label: string;
        onAction: () => void;
        durationMs?: number;
      }
    ) => {
      setToast({
        id: Date.now().toString(),
        message,
        actionLabel: action?.label,
        onAction: action?.onAction,
        durationMs: action?.durationMs,
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast toast={toast} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
