'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';

/*
 * Семантическая таблица.
 *
 * В operator таблицы были собраны из <div className="grid grid-cols-[...]">.
 * Выглядит как таблица, но для скринридера это набор строк текста: нет связи
 * ячейки с заголовком столбца, нельзя перемещаться по таблице, не объявляется
 * число строк. Плюс фиксированные grid-cols в px не переносятся на узкий экран.
 *
 * Здесь настоящие <table>/<th scope="col">, а горизонтальная прокрутка живёт
 * внутри своего контейнера — страница целиком по горизонтали не едет.
 */

export interface TableColumn<Row> {
  key: string;
  /** Заголовок столбца. */
  header: ReactNode;
  /** Ячейка. */
  cell: (row: Row, index: number) => ReactNode;
  /** Скрыть столбец ниже указанной ширины — вместо обрезки таблицы. */
  hideBelow?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right' | 'center';
  /** Ширина столбца, например '160px' или '1fr'-подобное '20%'. */
  width?: string;
}

export interface TableProps<Row> {
  /**
   * Описание таблицы для скринридера. Обязательно: без него пользователь,
   * попавший в таблицу, не знает, что в ней.
   */
  caption: string;
  /** Показывать caption визуально. По умолчанию только для скринридера. */
  captionVisible?: boolean;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** Нажатие на строку. Добавляет hover и делает строку кликабельной. */
  onRowClick?: (row: Row) => void;
  /** Подсветить строку как выбранную. */
  isRowSelected?: (row: Row) => boolean;
  /** Что показать вместо строк, когда их нет. */
  empty?: ReactNode;
  className?: string;
}

const HIDE_BELOW: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

const ALIGN: Record<'left' | 'right' | 'center', string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function Table<Row>({
  caption,
  captionVisible = false,
  columns,
  rows,
  rowKey,
  onRowClick,
  isRowSelected,
  empty,
  className,
}: TableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    // Прокрутка ограничена этим контейнером: требование «no horizontal scroll»
    // относится к странице, а широкая таблица законно скроллится внутри себя.
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left">
        <caption
          className={cn(
            'text-sm text-ink-soft',
            captionVisible ? 'mb-2 text-left' : 'sr-only',
          )}
        >
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                // scope="col" связывает каждую ячейку со своим заголовком.
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-3 py-2.5 text-2xs font-extrabold tracking-wide text-ink-soft uppercase',
                  'whitespace-nowrap',
                  ALIGN[col.align ?? 'left'],
                  col.hideBelow && HIDE_BELOW[col.hideBelow],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = isRowSelected?.(row) ?? false;
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                // Клик по строке доступен и с клавиатуры.
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? 'button' : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'border-b border-border last:border-0',
                  'transition-colors duration-(--duration-fast) ease-(--ease-out)',
                  clickable && 'cursor-pointer hover:bg-surface-sunken',
                  selected && 'bg-primary-soft',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-3 text-sm text-ink align-middle',
                      ALIGN[col.align ?? 'left'],
                      col.hideBelow && HIDE_BELOW[col.hideBelow],
                    )}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}