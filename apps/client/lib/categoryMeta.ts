import type { ComponentType } from 'react';
import {
  ApplianceIcon,
  CatalogIcon,
  DropletIcon,
  LockIcon,
  MoreIcon,
  PlugIcon,
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
  plumbing: { Icon: DropletIcon, subtitle: 'течи, засоры, смесители' },
  // Не BoltIcon: молния в этой системе занята срочным режимом.
  electrics: { Icon: PlugIcon, subtitle: 'розетки, проводка, свет' },
  appliances: { Icon: ApplianceIcon, subtitle: 'стиральные, холодильники' },
  locksmith: { Icon: LockIcon, subtitle: 'вскрытие, замена, установка' },
  handyman: { Icon: WrenchIcon, subtitle: 'полки, карнизы, мебель' },
  other: { Icon: MoreIcon, subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { Icon: CatalogIcon, subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
