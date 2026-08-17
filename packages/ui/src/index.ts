/**
 * Дизайн-система MasterQala.kz.
 *
 * Приложения подключают пакет исходниками (exports → src/index.ts), поэтому
 * отдельная сборка не нужна. Обязательное условие для Tailwind: в globals.css
 * приложения должна быть строка
 *   @source "../../../packages/ui/src";
 * иначе классы, использованные внутри этих компонентов, не попадут в CSS.
 */

export { cn } from './cn';
export type { ClassValue } from './cn';

/* Контролы */
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonVariant } from './IconButton';

/* Формы */
export { Field, useFieldIds, controlClasses } from './Field';
export type { FieldProps, FieldOwnProps, FieldRenderIds } from './Field';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';
export { Select } from './Select';
export type { SelectProps } from './Select';
export { ErrorSummary } from './ErrorSummary';
export type { ErrorSummaryProps, FormError } from './ErrorSummary';

/* Отображение */
export { Card } from './Card';
export type { CardProps } from './Card';
export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';
export { Table } from './Table';
export type { TableProps, TableColumn } from './Table';
export { EmptyState, default as EmptyStateDefault } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

/* Обратная связь */
export { Alert } from './Alert';
export type { AlertProps, AlertTone } from './Alert';
export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';
export { Skeleton, SkeletonList } from './Skeleton';
export type { SkeletonProps, SkeletonListProps } from './Skeleton';

/* Иконки. Эмодзи в интерфейсе не используются — только этот набор. */
export * from './icons';
