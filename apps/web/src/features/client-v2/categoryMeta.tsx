import type { ReactNode } from 'react';
import {
  BoltIcon,
  CatalogIcon,
  HomeIcon,
  MoreIcon,
  ShieldIcon,
  WrenchIcon,
} from '@masterqala/ui';

interface CategoryMeta {
  /** Иконка категории. Эмодзи в интерфейсе не используются — только набор из @masterqala/ui. */
  icon: ReactNode;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: { icon: <WrenchIcon size={20} />, subtitle: 'течи, засоры, смесители' },
  electrics: { icon: <BoltIcon size={20} />, subtitle: 'розетки, проводка, свет' },
  appliances: { icon: <HomeIcon size={20} />, subtitle: 'стиральные, холодильники' },
  locksmith: { icon: <ShieldIcon size={20} />, subtitle: 'вскрытие, замена, установка' },
  handyman: { icon: <CatalogIcon size={20} />, subtitle: 'полки, карнизы, мебель' },
  other: { icon: <MoreIcon size={20} />, subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { icon: <WrenchIcon size={20} />, subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
