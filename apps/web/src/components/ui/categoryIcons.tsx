import type { ComponentType, SVGProps } from 'react';
import { WrenchIcon, BoltIcon, MoreIcon } from './icons';

interface CategoryIconInfo {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  bg: string;
  color: string;
}

const CATEGORY_ICONS: Record<string, CategoryIconInfo> = {
  plumbing: { Icon: WrenchIcon, bg: '#DBEAFE', color: '#1E40AF' },
  electrics: { Icon: BoltIcon, bg: '#FEF3C7', color: '#B45309' },
};

const DEFAULT_ICON: CategoryIconInfo = { Icon: MoreIcon, bg: '#EDEAE2', color: '#8A8A8F' };

export function categoryIcon(slug: string): CategoryIconInfo {
  return CATEGORY_ICONS[slug] ?? DEFAULT_ICON;
}
