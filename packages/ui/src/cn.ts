/**
 * Склейка классов. Отбрасывает false/null/undefined.
 *
 * Намеренно не tailwind-merge: пакет решает конфликты вида «p-2 против p-4», а
 * компоненты здесь спроектированы так, чтобы конфликта не возникало — за
 * вариант и размер отвечают props (variant/size), а className остаётся для
 * добавочного: отступов снаружи, ширины, grid-área. Если в className начнут
 * передавать цвета и паддинги, спорящие с вариантом, — это сигнал, что не
 * хватает варианта, а не что нужен tailwind-merge.
 */
// Пустые значения из выражений `условие && 'класс'` — 0 и '' попадают сюда,
// когда условием оказывается число или строка.
export type ClassValue = string | number | bigint | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ');
}
