'use client';
import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

interface FieldOptions {
  label: string;
  leadingText?: string;
  variant?: 'web' | 'mobile' | 'responsive';
  error?: ReactNode;
  helper?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  containerClassName?: string;
}

export interface TextFieldProps extends ComponentPropsWithRef<'input'>, FieldOptions {}

/** Current MQ / Field 218:1365, adapted to editable native controls. */
export function TextField({ label, leadingText, variant = 'web', error, helper, loading = false, fullWidth = false, containerClassName = '',
  id: providedId, disabled, className = '', 'aria-describedby': describedBy, 'aria-invalid': invalid,
  type = 'text', ...props }: TextFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const descriptions = [describedBy, helper ? helperId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`mq-field mq-field--${variant}${fullWidth ? ' mq-field--full' : ''} ${containerClassName}`.trim()}
      data-error={Boolean(error) || undefined} data-disabled={disabled && !loading || undefined} data-loading={loading || undefined}>
      <label className="mq-field-label" htmlFor={id}>{label}</label>
      <div className="mq-field-value">{leadingText && <span aria-hidden="true">{leadingText}</span>}
      <input {...props} id={id} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
        aria-invalid={error ? true : invalid} aria-describedby={descriptions}
        className={`mq-field-control ${className}`.trim()} />
      </div>
      {helper && <p id={helperId} className="mq-field-help">{helper}</p>}
      {error && <p id={errorId} className="mq-field-error" role="alert">{error}</p>}
    </div>
  );
}
