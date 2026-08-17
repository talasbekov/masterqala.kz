import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'urgent'
  | 'success'
  | 'danger'
  | 'warning';

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/*
 * Каждая пара «текст на подложке» здесь даёт >= 4.5:1 — см. check-contrast.py.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-fill-soft text-on-fill',
  primary: 'bg-primary-soft text-primary-ink',
  urgent: 'bg-urgent-soft text-urgent-ink',
  success: 'bg-success-soft text-success-ink',
  danger: 'bg-danger-soft text-danger-ink',
  warning: 'bg-warning-soft text-warning-ink',
};

/**
 * Статусный бейдж.
 *
 * text-2xs (12px) — низ шкалы. Раньше бейджи набирались text-[10px] и
 * text-[11px] (47 использований): ниже 12px текст перестаёт читаться
 * пользователями со слабым зрением, а на бейдже статуса это единственный текст.
 *
 * whitespace-nowrap — короткая подпись не должна ломаться на две строки и
 * дёргать высоту строки таблицы.
 */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1',
        'text-2xs font-extrabold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
