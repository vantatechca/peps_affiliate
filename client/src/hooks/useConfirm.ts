import { useState, useCallback, useRef } from 'react';
import type { ConfirmVariant } from '../components/ConfirmModal';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: ConfirmVariant;
}

const defaultState: ConfirmState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  variant: 'danger',
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(defaultState);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      variant?: ConfirmVariant;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel || 'Confirm',
          variant: opts.variant || 'danger',
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    setState(defaultState);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState(defaultState);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return {
    confirmProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      confirmLabel: state.confirmLabel,
      variant: state.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    confirm,
  };
}
