import { Button } from '@masterqala/ui';

export function Primary() {
  return <Button>Вызвать мастера</Button>;
}

export function Secondary() {
  return <Button variant="secondary">Отменить</Button>;
}

export function DangerOutline() {
  return <Button variant="danger-outline">Отменить заявку</Button>;
}

export function Disabled() {
  return (
    <Button disabled onClick={() => {}}>
      Опубликовать заявку
    </Button>
  );
}
