'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'urgent' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Показать спиннер, заблокировать нажатие, выставить aria-busy. */
  loading?: boolean;
  /** Подпись на время загрузки. Без неё остаётся исходный текст. */
  loadingLabel?: string;
  /** Иконка слева. Декоративна — доступное имя даёт текст кнопки. */
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  /** Только для добавочного: внешние отступы, ширина, grid-area. */
  className?: string;
  children?: ReactNode;
}

/*
 * Варианты. `urgent` — только для режима «Сейчас»: оранжевый в этой системе
 * означает срочность, а не «ещё одна яркая кнопка».
 *
 * Все плотные заливки дают >= 4.5:1 с белым текстом (проверено
 * scripts/check-contrast.py). Раньше «успех» был #059669 и белый текст на нём
 * давал 3.77:1 — то есть подпись на кнопке подтверждения не проходила AA.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active',
  urgent: 'bg-urgent text-on-urgent hover:bg-urgent-hover',
  secondary:
    'bg-surface text-ink border border-border-strong hover:bg-surface-sunken active:bg-fill',
  ghost: 'bg-transparent text-primary hover:bg-primary-soft',
  danger: 'bg-danger text-on-danger hover:bg-danger-ink',
  success: 'bg-success text-on-success hover:bg-success-ink',
};

/*
 * Размеры. Минимум 44px по высоте у md/lg — цель нажатия из профиля
 * Accessible & Ethical. `sm` (36px) допустим только для плотных таблиц
 * оператора, где рядом нет других целей нажатия.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-base gap-2',
  lg: 'min-h-12 px-5 text-lg gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  icon,
  iconRight,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isBlocked = disabled || loading;

  return (
    <button
      type={type}
      disabled={isBlocked}
      // Сообщает скринридеру, что кнопка занята, не убирая её из потока.
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-pill font-bold',
        // Переход есть у всех состояний: мгновенная смена вида читается как сбой.
        // Под prefers-reduced-motion глушится в base.css.
        'transition-colors duration-(--duration-fast) ease-(--ease-out)',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
      {!loading && iconRight}
    </button>
  );
}