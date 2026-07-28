interface CategoryMeta {
  icon: string;
  subtitle: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: { icon: '🔧', subtitle: 'течи, засоры, смесители' },
  electrics: { icon: '⚡', subtitle: 'розетки, проводка, свет' },
  appliances: { icon: '🧊', subtitle: 'стиральные, холодильники' },
  locksmith: { icon: '🔐', subtitle: 'вскрытие, замена, установка' },
  handyman: { icon: '🔨', subtitle: 'полки, карнизы, мебель' },
  other: { icon: '🧹', subtitle: 'уборка, сборка, прочее' },
};

const DEFAULT_META: CategoryMeta = { icon: '🛠️', subtitle: '' };

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? DEFAULT_META;
}
