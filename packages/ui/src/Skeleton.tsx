import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
  /** Округление под форму содержимого. */
  shape?: 'text' | 'block' | 'circle';
}

/**
 * Заглушка на время загрузки.
 *
 * Раньше во всех пяти приложениях загрузка была строкой «Загрузка…»: содержимое
 * появлялось рывком и сдвигало вёрстку (CLS). Скелетон занимает место заранее.
 *
 * Сам по себе он для скринридера невидим — о занятости сообщает
 * SkeletonList/aria-busy на контейнере, иначе пользователь слышит десяток
 * пустых элементов.
 */
export function Skeleton({ className, shape = 'block' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse bg-fill',
        shape === 'text' && 'h-4 rounded-sm',
        shape === 'block' && 'rounded-md',
        shape === 'circle' && 'rounded-full',
        className,
      )}
    />
  );
}

export interface SkeletonListProps {
  /** Сколько строк-заглушек показать. */
  rows?: number;
  /** Подпись для скринридера. */
  label?: string;
  className?: string;
}

/** Список заглушек с корректным объявлением занятости. */
export function SkeletonList({
  rows = 3,
  label = 'Загрузка данных',
  className,
}: SkeletonListProps) {
  return (
    <div
      // aria-busy + role=status: скринридер сообщает о загрузке один раз,
      // не перечисляя заглушки.
      role="status"
      aria-busy="true"
      className={cn('flex flex-col gap-3', className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <Skeleton shape="text" className="mb-2 w-1/3" />
          <Skeleton shape="text" className="w-2/3" />
        </div>
      ))}
    </div>
  );
}
