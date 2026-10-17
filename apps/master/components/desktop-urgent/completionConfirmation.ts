import type {Locale} from '@masterqala/ui';

const copy = {
  ru: {
    title: 'Работа выполнена?',
    base: 'Клиент получит запрос на подтверждение. Без ответа заявка закроется автоматически через 24 часа.',
    pilot: 'В бесплатном пилоте платформа не списывает и не выплачивает деньги. Расчёты за работу — напрямую с клиентом.',
    direct: 'Оплата работы производится напрямую между клиентом и мастером. Платформа не переводит оплату в кошелёк.',
    mock: 'После подтверждения или автозакрытия в кошельке отразится тестовое начисление. Реальные деньги не переводятся.',
    confirmLabel: 'Выполнено', cancelLabel: 'Отмена', busyLabel: 'Подождите…',
  },
  kk: {
    title: 'Жұмыс аяқталды ма?',
    base: 'Клиентке растау сұрауы жіберіледі. Жауап болмаса, тапсырыс 24 сағаттан кейін автоматты түрде жабылады.',
    pilot: 'Тегін пилотта платформа ақша алмайды және төлем жасамайды. Жұмыс ақысын клиентпен тікелей келісіп есептесесіз.',
    direct: 'Жұмыс ақысы клиент пен шебер арасында тікелей төленеді. Платформа ақыны әмиянға аудармайды.',
    mock: 'Растаудан немесе автоматты жабылудан кейін әмиянда сынақ есептеуі көрсетіледі. Нақты ақша аударылмайды.',
    confirmLabel: 'Аяқталды', cancelLabel: 'Бас тарту', busyLabel: 'Күтіңіз…',
  },
  en: {
    title: 'Is the work complete?',
    base: 'The client will receive a confirmation request. If they do not respond, the order will close automatically after 24 hours.',
    pilot: 'During the free pilot, the platform does not charge or pay out money. Settle payment for the work directly with the client.',
    direct: 'Payment for the work is settled directly between the client and the master. The platform does not transfer payment to the wallet.',
    mock: 'After confirmation or automatic closure, a simulated credit will appear in the wallet. No real money is transferred.',
    confirmLabel: 'Complete', cancelLabel: 'Cancel', busyLabel: 'Please wait…',
  },
} satisfies Record<Locale, {title:string; base:string; pilot:string; direct:string; mock:string; confirmLabel:string; cancelLabel:string; busyLabel:string}>;

export function completionConfirmation(language:Locale, order:{commercialMode?:string; freePilot?:boolean}) {
  const text=copy[language];
  // Persisted order mode takes precedence over the legacy presentation flag.
  const mode=order.commercialMode ?? (order.freePilot ? 'FREE_PILOT' : undefined);
  const payment=mode==='FREE_PILOT'?text.pilot:mode==='DIRECT_PAYMENT'?text.direct:mode==='PAID_MOCK'?text.mock:'';
  return {title:text.title, body:[text.base,payment].filter(Boolean).join(' '), confirmLabel:text.confirmLabel, cancelLabel:text.cancelLabel, busyLabel:text.busyLabel};
}
