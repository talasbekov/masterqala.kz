import type { ComponentType } from 'react';
import {
  BoltIcon,
  CatalogIcon,
  HomeIcon,
  MoreIcon,
  ShieldIcon,
  WrenchIcon,
  type IconProps,
} from '@masterqala/ui';

interface CategoryMeta {
  /* Иконка из общего набора. Эмодзи в интерфейсе не используются: они
   * по-разному рисуются на разных ОС и озвучиваются скринридером не тем, что
   * значат. */
  Icon: ComponentType<IconProps>;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: { Icon: WrenchIcon, subtitle: 'течи, засоры, смесители' },
  electrics: { Icon: BoltIcon, subtitle: 'розетки, проводка, свет' },
  appliances: { Icon: HomeIcon, subtitle: 'стиральные, холодильники' },
  locksmith: { Icon: ShieldIcon, subtitle: 'вскрытие, замена, установка' },
  handyman: { Icon: WrenchIcon, subtitle: 'полки, карнизы, мебель' },
  other: { Icon: MoreIcon, subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { Icon: CatalogIcon, subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
