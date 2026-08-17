'use client';

import type { SelectHTMLAttributes, ReactNode } from 'react';
import { Field, controlClasses, useFieldIds } from './Field';
import type { FieldOwnProps } from './Field';
import { cn } from './cn';
import { ChevronDownIcon } from './icons';

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'>,
    FieldOwnProps {
  children: ReactNode;
  fieldClassName?: string;
}

/** Нативный <select>: на мобильных даёт системный выбор, доступен из коробки. */
export function Select({
  label,
  labelHidden,
  hint,
  error,
  required,
  className,
  fieldClassName,
  children,
  ...rest
}: SelectProps) {
  const ids = useFieldIds(hint, error);

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
      <div className="relative">
        <select
          id={ids.id}
          aria-describedby={ids.describedBy}
          aria-invalid={ids.invalid || undefined}
          required={required}
          className={cn(controlClasses(ids.invalid, 'appearance-none pr-10'), className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDownIcon
          size={18}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft"
        />
      </div>
    </Field>
  );
}