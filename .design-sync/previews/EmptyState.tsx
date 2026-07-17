import { EmptyState, ListIcon } from '@masterqala/ui';

export function Default() {
  return (
    <EmptyState
      icon={<ListIcon className="h-8 w-8" />}
      title="Заявок пока нет"
      subtitle="Здесь появится история ваших вызовов"
    />
  );
}

export function TitleOnly() {
  return <EmptyState icon={<ListIcon className="h-8 w-8" />} title="Заявок пока нет" />;
}
