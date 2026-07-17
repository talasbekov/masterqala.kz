import { Avatar } from '@masterqala/ui';

export function Named() {
  return <Avatar name="Айдар Б." />;
}

export function Unknown() {
  return <Avatar name={null} />;
}

export function Large() {
  return <Avatar name="Гульнара С." size={64} />;
}
