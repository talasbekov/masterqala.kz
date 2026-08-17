'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/*
 * Обвязка поля формы: видимая подпись, подсказка, ошибка — и связывающие их
 * атрибуты.
 *
 * Почему подпись обязательна. До редизайна в master и operator было ноль
 * элементов <label>: роль подписи играл placeholder. Это ломается трижды —
 * подпись исчезает, как только пользователь начал ввод; её не за что нажать;
 * а цвет placeholder'а давал 2.44:1 и не читался вовсе. Здесь подпись — не
 * опция, а обязательный prop. Спрятать её можно только осознанно, через
 * labelHidden (тогда она остаётся для скринридера).
 */

export interface FieldOwnProps {
  /** Видимая подпись. Обязательна. */
  label: string;
  /**
   * Убрать подпись визуально, оставив для скринридера. Только когда назначение
   * очевидно из контекста — например, поиск рядом с иконкой лупы.
   */
  labelHidden?: boolean;
  /** Поясняющий текст под подписью. Читается до ввода. */
  hint?: string;
  /** Текст ошибки. Появляется рядом с полем, а не только сверху формы. */
  error?: string;
  required?: boolean;
  className?: string;
}

export interface FieldRenderIds {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

/** Идентификаторы и связи для контрола внутри Field. */
export function useFieldIds(hint?: string, error?: string): FieldRenderIds {
  const base = useId();
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  // aria-describedby принимает список: подсказка и ошибка озвучиваются обе.
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id: `${base}-control`, describedBy, invalid: Boolean(error) };
}

export interface FieldProps extends FieldOwnProps {
  ids: FieldRenderIds;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({
  label,
  labelHidden,
  hint,
  error,
  required,
  className,
  ids,
  children,
}: FieldProps) {
  const base = ids.id.replace(/-control$/, '');
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={ids.id}
        className={cn(
          'text-sm font-bold text-ink',
          labelHidden && 'sr-only',
        )}
      >
        {label}
        {required ? (
          <>
            {' '}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(обязательное поле)</span>
          </>
        ) : null}
      </label>

      {hint ? (
        <p id={`${base}-hint`} className="text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}

      {children}

      {error ? (
        // role="alert" — ошибка озвучивается сразу после появления.
        <p
          id={`${base}-error`}
          role="alert"
          className="flex items-start gap-1 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Общие классы контрола: видимая граница, читаемый placeholder, 44px высота. */
export const controlClasses = (invalid: boolean, extra?: string) =>
  cn(
    'w-full rounded-md bg-surface px-3.5 text-base text-ink',
    'min-h-11 placeholder:text-ink-muted',
    // Граница даёт >= 3:1 к любой поверхности (WCAG 1.4.11). Раньше она была
    // #C0D6DF — 1.51:1, поля почти не читались как поля.
    'border transition-colors duration-(--duration-fast) ease-(--ease-out)',
    invalid ? 'border-danger' : 'border-border-strong hover:border-ink-muted',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted',
    extra,
  );