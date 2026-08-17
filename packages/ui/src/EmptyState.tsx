import type { ReactNode } from 'react';
import { cn } from './cn';
import { InboxIcon } from './icons';

export interface EmptyStateProps {
  /** Иконка. По умолчанию — «пустой лоток». */
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Действие, которое выводит из пустого состояния. */
  action?: ReactNode;
  className?: string;
}

/**
 * Пустое состояние: объясняет, почему пусто, и предлагает выход.
 *
 * Подпись набрана text-ink-soft (7.24:1), а не прежним text-muted (2.44:1) —
 * пояснение в пустом состоянии несёт основную смысловую нагрузку и должно
 * читаться.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-border bg-surface',
        'px-6 py-12 text-center',
        className,
      )}
    >
      <span className="text-ink-muted" aria-hidden="true">
        {icon ?? <InboxIcon size={32} />}
      </span>
      <p className="text-lg font-bold text-ink">{title}</p>
      {subtitle ? <p className="max-w-prose text-sm text-ink-soft">{subtitle}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
