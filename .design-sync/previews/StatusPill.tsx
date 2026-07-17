import { StatusPill } from '@masterqala/ui';

export function Info() {
  return <StatusPill variant="info">Поиск мастера</StatusPill>;
}

export function Active() {
  return <StatusPill variant="active">Мастер в пути</StatusPill>;
}

export function Success() {
  return <StatusPill variant="success">Выполнена</StatusPill>;
}

export function Danger() {
  return <StatusPill variant="danger">Спор</StatusPill>;
}
