'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { Field, controlClasses, useFieldIds } from './Field';
import type { FieldOwnProps } from './Field';
import { cn } from './cn';

export interface InputProps
  // 'prefix' исключён из HTML-атрибутов намеренно: у него там свой тип (string,
  // для RDFa) и он конфликтует с нашим ReactNode-префиксом поля.
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id' | 'prefix'>,
    FieldOwnProps {
  /** Постоянный префикс внутри поля, например «+7» у телефона. */
  prefix?: ReactNode;
  fieldClassName?: string;
}

export function Input({
  label,
  labelHidden,
  hint,
  error,
  required,
  className,
  fieldClassName,
  prefix,
  ...rest
}: InputProps) {
  const ids = useFieldIds(hint, error);

  const control = (
    <input
      id={ids.id}
      aria-describedby={ids.describedBy}
      // aria-invalid включается только при реальной ошибке: постоянное
      // «невалидно» на пустом поле сбивает скринридер.
      aria-invalid={ids.invalid || undefined}
      required={required}
      className={cn(
        controlClasses(ids.invalid),
        prefix && 'rounded-l-none border-l-0',
        className,
      )}
      {...rest}
    />
  );

  return (
    <Field
      label={label}
      labelHidden={labelHidden}
      hint={hint}
      error={error}
      required={required}
      ids={ids}
      className={fieldClassName}
    >
      {prefix ? (
        <div className="flex">
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex min-h-11 items-center rounded-l-md border border-r-0 px-3',
              'bg-surface-sunken text-base font-semibold text-ink-soft',
              ids.invalid ? 'border-danger' : 'border-border-strong',
            )}
          >
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
    </Field>
  );
}