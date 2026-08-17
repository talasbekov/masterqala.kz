'use client';

import { useEffect, useRef } from 'react';
import { cn } from './cn';
import { XCircleIcon } from './icons';

export interface FormError {
  /** id контрола, к которому ведёт ссылка. */
  fieldId: string;
  message: string;
}

export interface ErrorSummaryProps {
  errors: FormError[];
  title?: string;
  className?: string;
}

/**
 * Сводка ошибок в начале формы.
 *
 * Дополняет, а НЕ заменяет ошибки у полей: подсказки у поля остаются на месте
 * (их рисует Field). Сводка нужна для длинных форм — после неудачной отправки
 * пользователь оказывается в ней и может перейти к любому сбойному полю.
 *
 * Фокус переносится один раз, после появления ошибок, а не на каждый blur.
 * tabIndex={-1} делает контейнер программно фокусируемым, не добавляя его в
 * порядок обхода Tab.
 */
export function ErrorSummary({
  errors,
  title = 'Проверьте форму',
  className,
}: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const count = errors.length;

  useEffect(() => {
    if (count > 0) {
      ref.current?.focus();
    }
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={cn(
        'rounded-lg border border-danger/30 bg-danger-soft px-4 py-3',
        className,
      )}
    >
      <p className="flex items-center gap-2 font-extrabold text-danger-ink">
        <XCircleIcon size={20} />
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1 ps-1">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              href={`#${error.fieldId}`}
              className="text-sm font-semibold text-danger-ink underline hover:no-underline"
              onClick={(event) => {
                // Ссылка-якорь не всегда переводит фокус в сам контрол —
                // переносим его явно, иначе клавиатура остаётся в сводке.
                event.preventDefault();
                const target = document.getElementById(error.fieldId);
                target?.focus();
                target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}