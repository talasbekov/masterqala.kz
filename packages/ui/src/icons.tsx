import type { SVGProps } from 'react';

/*
 * Иконки MasterQala.kz — единое семейство, обводка, 24×24, currentColor.
 *
 * Набор существует, чтобы в интерфейсе не было эмодзи. До редизайна в коде
 * было 62 эмодзи в роли иконок (client 43, operator 12, master 7): они
 * по-разному рисуются на разных ОС, не наследуют цвет, не масштабируются под
 * размер текста и озвучиваются скринридером как «слон», «телефон со стрелкой»
 * и прочее вместо смысла элемента.
 *
 * Доступность. Иконка сама по себе для скринридера скрыта: aria-hidden стоит по
 * умолчанию, потому что в 95% случаев рядом есть текст. Если иконка стоит одна и
 * несёт смысл — берите IconButton (он требует label) или передайте title.
 */

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Размер в px, по умолчанию 20. Иконки квадратные. */
  size?: number | string;
  /** Доступное имя. Задавайте, только если рядом нет текста. */
  title?: string;
}

function useIconProps({ size = 20, title, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    // Декоративна по умолчанию; с title становится озвучиваемой.
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
    focusable: false,
    ...rest,
  };
}

/** Обёртка: единый набор атрибутов + необязательный <title>. */
function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  const { title } = props;
  const svgProps = useIconProps(props);
  return (
    <svg {...svgProps}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ── Режимы заявки ───────────────────────────────────────────────────────── */

/** Срочный режим «Сейчас». Заменяет ⚡ */
export const BoltIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
  </Icon>
);

/** Плановый режим. Заменяет 📅 */
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </Icon>
);

/* ── Навигация ───────────────────────────────────────────────────────────── */

/** Заменяет ⌂ */
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5" />
  </Icon>
);

/** Список заявок. Заменяет ☰ */
export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Icon>
);

/** Каталог услуг. Заменяет 🗂️ */
export const CatalogIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2.5h6a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" />
    <path d="M3 11h18" />
  </Icon>
);

/** Профиль. Заменяет ◉ */
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

/** Уведомления. Заменяет 🔔 */
export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z" />
    <path d="M10 18.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
);

/** Заменяет ← */
export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

/* ── Действия и состояния ────────────────────────────────────────────────── */

/** Заменяет ✓ */
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12.5l5 5 10-10" />
  </Icon>
);

/** Галочка в круге — подтверждено, верифицировано. */
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Icon>
);

/** Заменяет × */
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const XCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
);

/** Заменяет 📞 */
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 3.5h2.2l1.6 4-2 1.4a10.5 10.5 0 0 0 4.8 4.8l1.4-2 4 1.6v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  </Icon>
);

/** Рейтинг. Заменяет ★ — заливка через prop filled. */
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z" />
  </Icon>
);

/** Гарантия, безопасность. Заменяет 🛡️ */
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7.5 2.7v5.6c0 4.4-3 8.1-7.5 9.2-4.5-1.1-7.5-4.8-7.5-9.2V5.7L12 3Z" />
  </Icon>
);

/** Мастер, работы. */
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z" />
  </Icon>
);

/** Кошелёк мастера. */
export const WalletIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10.5h18M16.5 15h2" />
  </Icon>
);

/** Оплата. Заменяет 💳 */
export const CardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
    <path d="M2.5 10h19M6 14.5h4" />
  </Icon>
);

/** Бесплатный пилот, бонус. Заменяет 🎁 */
export const GiftIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="8.5" width="18" height="12" rx="2" />
    <path d="M3 12.5h18M12 8.5v12" />
    <path d="M12 8.5S10.5 3.5 8 4.5s1 4 4 4Zm0 0s1.5-5 4-4-1 4-4 4Z" />
  </Icon>
);

/** Споры и арбитраж. Заменяет ⚖️ */
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v16M7 20h10M4 8l8-2 8 2" />
    <path d="M4 8l-2 5a3 3 0 0 0 4 0L4 8ZM20 8l2 5a3 3 0 0 1-4 0l2-5Z" />
  </Icon>
);

/** Lead-кредиты. */
export const CoinsIcon = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="6.5" rx="7" ry="3" />
    <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </Icon>
);

/** Адрес, точка на карте. */
export const MapPinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3.5 2" />
  </Icon>
);

/** Предупреждение. Заменяет ⚠ */
export const AlertTriangleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4l9 15.5H3L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
);

/** Справка. Заменяет ? */
export const HelpIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01" />
  </Icon>
);

/** Фото к заявке. */
export const PhotoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <circle cx="8.5" cy="10" r="1.75" />
    <path d="M21 16l-5-4.5L7 19" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v12M7.5 11.5L12 16l4.5-4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </Icon>
);

/** Пустой список. Осмысленная замена 😔 */
export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13.5l2.5-8A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5l2.5 8" />
    <path d="M3 13.5h5l1 2.5h6l1-2.5h5v4A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-4Z" />
  </Icon>
);

/** Выход из аккаунта. */
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Icon>
);

/** Пользователи (оператор). */
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.6a3.25 3.25 0 0 1 0 5.8M17.5 20a6 6 0 0 0-1.8-4.3" />
  </Icon>
);

/** Метрики, дашборд. */
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16M7 20v-6M12 20V7M17 20v-9" />
  </Icon>
);

/** Журнал аудита. */
export const JournalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 19.5v-15Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Icon>
);

/** Верификация документов. */
export const DocumentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5h7L18.5 9v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z" />
    <path d="M13 3.5V9h5.5" />
  </Icon>
);

/** Живая позиция мастера на карте. Заменяет 🚗 */
export const CarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 16.5v-3l1.8-4.4A2 2 0 0 1 7.6 8h8.8a2 2 0 0 1 1.8 1.1L20 13.5v3" />
    <path d="M3 16.5h18M7 19.5v-3M17 19.5v-3" />
  </Icon>
);

/* ── Категории услуг ─────────────────────────────────────────────────────────
 * Отдельные иконки, а не переиспользование общих. Причина: BoltIcon в этой
 * системе означает срочный режим, и ставить его же на категорию «Электрика»
 * значит размыть единственный смысл, который несёт молния. Гаечный ключ до
 * этого стоял сразу на двух категориях. */

/** Сантехника. */
export const DropletIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5s6 6.2 6 10.1a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5Z" />
  </Icon>
);

/** Электрика. */
export const PlugIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3v5M15 3v5" />
    <path d="M6.5 8h11v2.5a5.5 5.5 0 0 1-11 0V8Z" />
    <path d="M12 16v5" />
  </Icon>
);

/** Замки и двери. */
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

/** Бытовая техника. */
export const ApplianceIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M4 8h16" />
    <circle cx="12" cy="14.5" r="3.5" />
    <path d="M7 5.5h.01M10 5.5h.01" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.5 3.9a2 2 0 0 1 2.8 2.8L8 18l-4 1 1-4L16.5 3.9Z" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Icon>
);
