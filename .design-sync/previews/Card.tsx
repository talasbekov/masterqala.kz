import { Card, Avatar, StatusPill } from '@masterqala/ui';

export function Default() {
  return (
    <Card>
      <div className="font-bold text-foreground">Протечка крана</div>
      <div className="text-sm text-muted">ул. Абая 24</div>
    </Card>
  );
}

export function WithAvatarAndStatus() {
  return (
    <Card className="flex items-center gap-3">
      <Avatar name="Айдар Б." />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-foreground">Сантехника</div>
        <div className="truncate text-sm text-muted">ул. Абая 24</div>
        <div className="mt-1.5">
          <StatusPill variant="active">Мастер в пути</StatusPill>
        </div>
      </div>
    </Card>
  );
}
