'use client';

import type { TextareaHTMLAttributes } from 'react';
import { Field, controlClasses, useFieldIds } from './Field';
import type { FieldOwnProps } from './Field';
import { cn } from './cn';

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'>,
    FieldOwnProps {
  fieldClassName?: string;
}

export function Textarea({
  label,
  labelHidden,
  hint,
  error,
  required,
  className,
  fieldClassName,
  rows = 4,
  ...rest
}: TextareaProps) {
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
      <textarea
        id={ids.id}
        rows={rows}
        aria-describedby={ids.describedBy}
        aria-invalid={ids.invalid || undefined}
        required={required}
        className={cn(controlClasses(ids.invalid, 'py-3 leading-relaxed'), className)}
        {...rest}
      />
    </Field>
  );
}