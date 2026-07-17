import type { ReactNode } from 'react';

interface CategoryTileProps {
  label: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}

export default function CategoryTile({ label, icon, iconBg, iconColor, onClick }: CategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg bg-surface p-3 text-center shadow-card"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-md"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-semibold leading-tight text-foreground">{label}</span>
    </button>
  );
}
