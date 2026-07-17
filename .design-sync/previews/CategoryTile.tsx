import { CategoryTile, WrenchIcon, BoltIcon } from '@masterqala/ui';

export function Plumbing() {
  return (
    <CategoryTile
      label="Сантехника"
      icon={<WrenchIcon className="h-6 w-6" />}
      iconBg="#DBEAFE"
      iconColor="#1E40AF"
    />
  );
}

export function Electrics() {
  return (
    <CategoryTile
      label="Электрика"
      icon={<BoltIcon className="h-6 w-6" />}
      iconBg="#FEF3C7"
      iconColor="#B45309"
    />
  );
}
