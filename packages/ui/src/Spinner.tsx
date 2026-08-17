import { cn } from './cn';

export interface SpinnerProps {
  size?: number;
  className?: string;
  /** Доступная подпись. Ставьте, если спиннер стоит один, без текста рядом. */
  label?: string;
}

/**
 * Индикатор занятости.
 *
 * Под prefers-reduced-motion не выключается, а замедляется (см. base.css):
 * вращение здесь сообщает «система работает», убрать его целиком — значит
 * убрать информацию.
 */
export function Spinner({ size = 18, className, label }: SpinnerProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
          className,
        )}
        style={{ width: size, height: size }}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
