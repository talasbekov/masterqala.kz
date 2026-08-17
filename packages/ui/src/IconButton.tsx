'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type IconButtonVariant = 'ghost' | 'surface' | 'primary' | 'danger';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /**
   * Доступное имя. Обязательно и намеренно: у кнопки без текста нет другого
   * способа сообщить, что она делает.
   *
   * До редизайна в четырёх приложениях было 125 кнопок и ни одного aria-label,
   * а роль текста играли эмодзи. Тип этого поля — единственная гарантия, что
   * такое не соберётся снова.
   */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  className?: string;
}

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: 'text-ink-soft hover:bg-fill-soft hover:text-ink',
  surface: 'bg-surface text-ink border border-border-strong hover:bg-surface-sunken',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  danger: 'bg-danger-soft text-danger-ink hover:bg-danger hover:text-on-danger',
};

/**
 * Кнопка из одной иконки. Всегда 44×44 — минимальная цель нажатия.
 */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      // Подсказка при наведении дублирует доступное имя — полезно зрячим
      // пользователям, которым иконка непонятна.
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-pill',
        'transition-colors duration-(--duration-fast) ease-(--ease-out)',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}