import { useEffect } from 'react';
import { cn } from '../lib/cn';

export type ToastVariant = 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  visible: boolean;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, variant = 'success', visible, duration = 2200, onClose }: ToastProps) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible) {
    return null;
  }

  return <div className={cn('toast', `toast-${variant}`)}>{message}</div>;
}
