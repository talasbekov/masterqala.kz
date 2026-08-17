import type { ReactNode } from 'react';
import {
  ApplianceIcon,
  CatalogIcon,
  DropletIcon,
  LockIcon,
  MoreIcon,
  PlugIcon,
  WrenchIcon,
} from '@masterqala/ui';

interface CategoryMeta {
  /** Иконка категории. Эмодзи в интерфейсе не используются — только набор из @masterqala/ui. */
  icon: ReactNode;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: { icon: <DropletIcon size={20} />, subtitle: 'течи, засоры, смесители' },
  electrics: { icon: <PlugIcon size={20} />, subtitle: 'розетки, проводка, свет' },
  appliances: { icon: <ApplianceIcon size={20} />, subtitle: 'стиральные, холодильники' },
  locksmith: { icon: <LockIcon size={20} />, subtitle: 'вскрытие, замена, установка' },
  handyman: { icon: <WrenchIcon size={20} />, subtitle: 'полки, карнизы, мебель' },
  other: { icon: <MoreIcon size={20} />, subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { icon: <CatalogIcon size={20} />, subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
