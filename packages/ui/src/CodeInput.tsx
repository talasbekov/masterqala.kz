'use client';
import { useId } from 'react';
import type { ComponentPropsWithRef } from 'react';
export interface CodeInputProps extends Omit<ComponentPropsWithRef<'input'>, 'onChange' | 'onInput' | 'onPaste' | 'value'> {
  label: string; value: string; onChange: (value: string) => void; error?: string;
}
const digits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

/** Desktop 99:1493 / Mobile 161:1610: one editable control, six visual cells. */
export function CodeInput({ label, value, onChange, error, id: providedId, disabled, className = '', ...props }: CodeInputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  return <div className="mq-code" data-error={Boolean(error) || undefined} data-disabled={disabled || undefined}>
    <div className="mq-code-editor">
      <label htmlFor={id} className="mq-code-label">{label}</label>
      <div className="mq-code-digits" aria-hidden="true">{Array.from({ length: 6 }, (_, index) =>
        <span className="mq-code-digit" data-filled={Boolean(value[index]) || undefined} key={index}>{value[index] ?? '—'}</span>)}</div>
      <input {...props} className={`mq-code-control ${className}`.trim()} id={id} type="text" inputMode="numeric"
        autoComplete="one-time-code" maxLength={6} value={value} disabled={disabled}
        aria-invalid={error ? true : undefined} aria-describedby={[props['aria-describedby'], error ? errorId : ''].filter(Boolean).join(' ') || undefined}
        onChange={() => { /* Normalization is handled by onInput below. */ }}
        onInput={event => { if (!disabled) onChange(digits(event.currentTarget.value)); }}
        onPaste={event => { event.preventDefault(); if (!disabled) onChange(digits(event.clipboardData.getData('text'))); }} />
    </div>
    {error && <p className="mq-code-error" role="alert" id={errorId}>{error}</p>}
  </div>;
}
