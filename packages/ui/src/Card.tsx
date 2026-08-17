import type { ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps {
  children: ReactNode;
  /** Плотность внутренних отступов. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Приподнять карточку тенью — для оверлеев и активных элементов. */
  raised?: boolean;
  className?: string;
  /** Отрисовать другим тегом: section, article, li. */
  as?: 'div' | 'section' | 'article' | 'li';
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

/** Базовая поверхность контента. */
export function Card({
  children,
  padding = 'md',
  raised = false,
  className,
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-border bg-surface',
        raised ? 'shadow-raised' : 'shadow-card',
        PADDING[padding],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
