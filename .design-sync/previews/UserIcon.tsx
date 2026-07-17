import { UserIcon } from '@masterqala/ui';

export function Inactive() {
  return <UserIcon className="h-6 w-6 text-muted" />;
}

export function Active() {
  return <UserIcon className="h-6 w-6 text-primary" />;
}
