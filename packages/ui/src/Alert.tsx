import type { ReactNode } from 'react';
import { cn } from './cn';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  HelpIcon,
  XCircleIcon,
} from './icons';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const TONES: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-primary-soft text-primary-ink border-primary/20',
    icon: <HelpIcon size={20} />,
  },
  success: {
    box: 'bg-success-soft text-success-ink border-success/20',
    icon: <CheckCircleIcon size={20} />,
  },
  warning: {
    box: 'bg-warning-soft text-warning-ink border-warning/20',
    icon: <AlertTriangleIcon size={20} />,
  },
  danger: {
    box: 'bg-danger-soft text-danger-ink border-danger/20',
    icon: <XCircleIcon size={20} />,
  },
};

/**
 * Сообщение о состоянии.
 *
 * Ошибки и предупреждения получают role="alert" — скринридер озвучивает их сразу.
 * Информационные и успешные — role="status", то есть вежливо, не перебивая.
 *
 * Тон никогда не единственный носитель смысла: рядом с цветом всегда иконка,
 * иначе сообщение теряется при дальтонизме.
 */
export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { box, icon } = TONES[tone];
  const assertive = tone === 'danger' || tone === 'warning';

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        box,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="flex-1">
        {title ? <p className="font-extrabold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  );
}
