import type { ReactNode } from 'react';
import type { StatusVariant } from '../../orderStatus';

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  info: 'bg-primary/10 text-primary',
  active: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
};

interface StatusPillProps {
  variant: StatusVariant;
  children: ReactNode;
}

export default function StatusPill({ variant, children }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}
