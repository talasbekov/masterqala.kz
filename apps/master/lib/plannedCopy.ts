import {formatServiceDate} from '@masterqala/ui';
const en = {
  title: 'Planned requests', detail: 'Planned order', back: 'Back to requests', history: 'My orders', refresh: 'Refresh', loading: 'Loading requests…', dispute: 'Order dispute',
  empty: 'No requests in your specialties yet', emptyNote: 'New requests will appear here when clients publish them.',
  free: 'Free response', freeNote: 'Respond for free. The client chooses a master from the offers received.',
  paid: 'This request uses lead credits', paidNote: 'This legacy request requires one lead credit to respond.', credits: 'Lead-credit balance', buyCredits: 'Manage lead credits',
  unavailable: 'This order is unavailable to your account.', read: 'Could not refresh. Check your connection and try again.',
  uncertain: 'The result could not be verified. Refresh before trying again; your draft is preserved.', changed: 'The order changed. Review the latest state before continuing.', failed: 'The action was not confirmed. Review the latest state and try again.',
  offline: 'You are offline. Reconnect and refresh before making changes.', stale: 'Showing previously loaded details. Refresh before making changes.',
  category: 'Service', district: 'District', slot: 'Requested time', budget: 'Client budget', description: 'Task', offers: 'Offers', full: 'The response limit has been reached',
  price: 'Your price, ₸', term: 'Completion time', comment: 'Comment (optional)', submit: 'Send free response', submitPaid: 'Respond for 1 lead credit',
  draft: 'Your draft is saved in this tab. Nothing is sent until you submit.', unsaved: 'Draft storage is unavailable. Keep this page open to preserve your text.',
  submitted: 'Your response was sent', submittedNote: 'The client will choose a master. Submitted responses cannot be edited.', open: 'Open selected order',
  confirm: 'Confirm order', decline: 'Decline selection', 'on-site': 'I am on site', complete: 'Mark work complete', cancel: 'Cancel my participation',
  confirmCancel: 'Cancel your participation?', cancelNote: 'The request will return to the feed. Confirm only if you cannot continue.', yesCancel: 'Yes, cancel participation', keep: 'Keep order',
  address: 'Address', entrance: 'Entrance', floor: 'Floor', apartment: 'Apartment', instructions: 'Address instructions', client: 'Client', contact: 'Client phone', deadline: 'Confirm by',
  invalidBid: 'Enter a whole positive price and a completion time (up to 200 characters).', waiting: 'Waiting for the client to confirm completion.',
  PUBLISHED: 'Collecting responses', MASTER_SELECTED: 'The client selected you', CONFIRMED: 'Order confirmed', IN_PROGRESS: 'Work in progress', DONE: 'Work marked complete', CLOSED: 'Order closed', CANCELLED_BY_CLIENT: 'Cancelled by the client', CANCELLED_BY_MASTER: 'Cancelled by the master', EXPIRED: 'Request expired', CREATED: 'Request created',
  blocked: 'This workflow is not available.', busy: 'Updating…', unknown: 'Not specified', released: 'Your participation has ended. The request is collecting responses again.', historyNote: 'Selected orders and your order history are available here.',
};
type Copy = Record<keyof typeof en, string>;
const ru: Copy = {
  title: 'Плановые заявки', detail: 'Плановый заказ', back: 'К заявкам', history: 'Мои заказы', refresh: 'Обновить', loading: 'Загружаем заявки…', dispute: 'Спор по заказу',
  empty: 'Пока нет заявок по вашим специальностям', emptyNote: 'Новые заявки появятся здесь, когда клиенты их опубликуют.',
  free: 'Бесплатный отклик', freeNote: 'Откликайтесь бесплатно. Клиент сам выбирает мастера из полученных предложений.',
  paid: 'Заявка с lead-кредитами', paidNote: 'Для отклика на эту заявку прежней модели нужен один lead-кредит.', credits: 'Баланс lead-кредитов', buyCredits: 'Управление lead-кредитами',
  unavailable: 'Этот заказ недоступен вашему аккаунту.', read: 'Не удалось обновить. Проверьте соединение и повторите попытку.',
  uncertain: 'Результат не удалось проверить. Обновите данные перед повторной попыткой. Черновик сохранён.', changed: 'Заказ изменился. Проверьте актуальное состояние перед продолжением.', failed: 'Действие не подтверждено. Проверьте актуальное состояние и повторите попытку.',
  offline: 'Нет соединения. Подключитесь к сети и обновите данные перед изменениями.', stale: 'Показаны ранее загруженные данные. Обновите их перед изменениями.',
  category: 'Услуга', district: 'Район', slot: 'Запрошенное время', budget: 'Бюджет клиента', description: 'Задача', offers: 'Отклики', full: 'Лимит откликов достигнут',
  price: 'Ваша цена, ₸', term: 'Срок выполнения', comment: 'Комментарий (необязательно)', submit: 'Отправить бесплатный отклик', submitPaid: 'Откликнуться за 1 lead-кредит',
  draft: 'Черновик сохранён в этой вкладке. Он отправится только по нажатию кнопки.', unsaved: 'Хранилище черновиков недоступно. Не закрывайте страницу, чтобы сохранить текст.',
  submitted: 'Ваш отклик отправлен', submittedNote: 'Клиент выберет мастера. Отправленные отклики нельзя изменить.', open: 'Открыть выбранный заказ',
  confirm: 'Подтвердить заказ', decline: 'Отказаться от выбора', 'on-site': 'Я на месте', complete: 'Завершить работу', cancel: 'Отменить своё участие',
  confirmCancel: 'Отменить своё участие?', cancelNote: 'Заявка вернётся в ленту. Подтвердите, только если не можете продолжить.', yesCancel: 'Да, отменить участие', keep: 'Сохранить заказ',
  address: 'Адрес', entrance: 'Подъезд', floor: 'Этаж', apartment: 'Квартира', instructions: 'Комментарий к адресу', client: 'Клиент', contact: 'Телефон клиента', deadline: 'Подтвердите до',
  invalidBid: 'Укажите целую положительную цену и срок выполнения (до 200 символов).', waiting: 'Ожидаем подтверждения завершения от клиента.',
  PUBLISHED: 'Сбор откликов', MASTER_SELECTED: 'Клиент выбрал вас', CONFIRMED: 'Заказ подтверждён', IN_PROGRESS: 'Работа выполняется', DONE: 'Работа завершена', CLOSED: 'Заказ закрыт', CANCELLED_BY_CLIENT: 'Отменён клиентом', CANCELLED_BY_MASTER: 'Отменён мастером', EXPIRED: 'Срок заявки истёк', CREATED: 'Заявка создана',
  blocked: 'Этот сценарий пока недоступен.', busy: 'Обновляем…', unknown: 'Не указано', released: 'Ваше участие завершено. Заявка снова собирает отклики.', historyNote: 'Здесь доступны выбранные заказы и история вашей работы.',
};
const kk: Copy = {
  title: 'Жоспарлы өтінімдер', detail: 'Жоспарлы тапсырыс', back: 'Өтінімдерге оралу', history: 'Менің тапсырыстарым', refresh: 'Жаңарту', loading: 'Өтінімдер жүктелуде…', dispute: 'Тапсырыс бойынша дау',
  empty: 'Мамандықтарыңыз бойынша өтінімдер әзірге жоқ', emptyNote: 'Клиенттер жариялаған жаңа өтінімдер осында көрсетіледі.',
  free: 'Тегін ұсыныс', freeNote: 'Ұсынысты тегін жіберіңіз. Клиент түскен ұсыныстардан шеберді өзі таңдайды.',
  paid: 'Lead-кредиттері бар өтінім', paidNote: 'Бұрынғы үлгідегі осы өтінімге жауап беру үшін бір lead-кредит қажет.', credits: 'Lead-кредит балансы', buyCredits: 'Lead-кредиттерді басқару',
  unavailable: 'Бұл тапсырыс аккаунтыңызға қолжетімсіз.', read: 'Жаңарту мүмкін болмады. Байланысты тексеріп, қайталап көріңіз.',
  uncertain: 'Нәтижені тексеру мүмкін болмады. Қайта жібермес бұрын жаңартыңыз. Жоба сақталды.', changed: 'Тапсырыс өзгерді. Жалғастырмас бұрын қазіргі күйін тексеріңіз.', failed: 'Әрекет расталмады. Қазіргі күйін тексеріп, қайталап көріңіз.',
  offline: 'Интернет байланысы жоқ. Өзгерту үшін желіге қосылып, деректерді жаңартыңыз.', stale: 'Бұрын жүктелген деректер көрсетілген. Өзгерту алдында жаңартыңыз.',
  category: 'Қызмет', district: 'Аудан', slot: 'Сұралған уақыт', budget: 'Клиент бюджеті', description: 'Тапсырма', offers: 'Ұсыныстар', full: 'Ұсыныстар шегіне жетті',
  price: 'Сіздің бағаңыз, ₸', term: 'Орындау мерзімі', comment: 'Түсініктеме (міндетті емес)', submit: 'Тегін ұсыныс жіберу', submitPaid: '1 lead-кредитке ұсыныс жіберу',
  draft: 'Жоба осы қойындыда сақталады. Түймені басқанға дейін ештеңе жіберілмейді.', unsaved: 'Жобаны сақтау мүмкін емес. Мәтінді сақтау үшін бетті жаппаңыз.',
  submitted: 'Ұсынысыңыз жіберілді', submittedNote: 'Клиент шеберді таңдайды. Жіберілген ұсынысты өзгерту мүмкін емес.', open: 'Таңдалған тапсырысты ашу',
  confirm: 'Тапсырысты растау', decline: 'Таңдаудан бас тарту', 'on-site': 'Мен келдім', complete: 'Жұмысты аяқтау', cancel: 'Қатысуымнан бас тарту',
  confirmCancel: 'Қатысуыңыздан бас тартасыз ба?', cancelNote: 'Өтінім тізімге қайтарылады. Жалғастыра алмасаңыз ғана растаңыз.', yesCancel: 'Иә, бас тарту', keep: 'Тапсырысты сақтау',
  address: 'Мекенжай', entrance: 'Кіреберіс', floor: 'Қабат', apartment: 'Пәтер', instructions: 'Мекенжай түсініктемесі', client: 'Клиент', contact: 'Клиент телефоны', deadline: 'Растау мерзімі',
  invalidBid: 'Бүтін оң бағаны және орындау мерзімін енгізіңіз (200 таңбаға дейін).', waiting: 'Клиенттің жұмыстың аяқталғанын растауын күтеміз.',
  PUBLISHED: 'Ұсыныстар жиналуда', MASTER_SELECTED: 'Клиент сізді таңдады', CONFIRMED: 'Тапсырыс расталды', IN_PROGRESS: 'Жұмыс орындалуда', DONE: 'Жұмыс аяқталды', CLOSED: 'Тапсырыс жабылды', CANCELLED_BY_CLIENT: 'Клиент бас тартты', CANCELLED_BY_MASTER: 'Шебер бас тартты', EXPIRED: 'Өтінім мерзімі аяқталды', CREATED: 'Өтінім жасалды',
  blocked: 'Бұл мүмкіндік әзірге қолжетімсіз.', busy: 'Жаңартылуда…', unknown: 'Көрсетілмеген', released: 'Қатысуыңыз аяқталды. Өтінімге ұсыныстар қайта жиналуда.', historyNote: 'Таңдалған тапсырыстар мен жұмыс тарихы осында қолжетімді.',
};
export const plannedCopy = (language: string): Copy => language === 'kk' ? kk : language === 'en' ? en : ru;
export function plannedStatus(copy: Copy, status: string): string { return copy[status as keyof Copy] ?? copy.blocked; }
export function plannedSlot(start: string, end: string, language: string): string {
  const locale = language === 'kk' ? 'kk-KZ' : language === 'en' ? 'en-GB' : 'ru-RU';
  return `${formatServiceDate(new Date(start),locale,{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})} – ${formatServiceDate(new Date(end),locale,{hour:'2-digit',minute:'2-digit'})}`;
}
