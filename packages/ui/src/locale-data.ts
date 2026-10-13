export type Locale = 'ru'|'kk'|'en';
export const localeNames = {ru:'Русский',kk:'Қазақша',en:'English'};
export const ru = {
  createSubmissionInvalid:'Проверьте обязательные поля, длину текста и загруженные фотографии перед отправкой.',checkSubmission:'Проверить отправку',checkSubmissionBusy:'Проверяем отправку…',createOutcomeKeyedHelp:'Повтор использует тот же номер запроса и может завершить исходное создание, если первая попытка не была сохранена. Для этого номера он не создаёт вторую заявку. Также доступны ваши заказы и поддержка.',createOutcomeUnknown:'Результат отправки пока неизвестен',createOutcomeHelp:'Заявка могла быть создана. Проверьте свои заказы или обратитесь в поддержку. Повторная отправка сейчас недоступна, чтобы не создать дубликат.',createOutcomeStorage:'В этом браузере статус отправки не сохранён. Не перезагружайте страницу; после перезагрузки сначала проверьте свои заказы.',createOutcomeConfirmed:'Заявка создана',openCreatedOrder:'Открыть созданную заявку',
  desktopApprovedNote:'Цена согласована. Ожидаем начала работы мастером.',desktopApprovedStatus:'Цена согласована',approvedWorkMaterials:'Работа и материалы',addressEntrance:'Подъезд',addressFloor:'Этаж',addressApartment:'Квартира',approvedChangeNote:'Если изменятся работы или материалы, мастер должен отправить новую смету и получить ваше согласие.',masterApprovedNamed:'Клиент {{name}} подтвердил объём работ и сумму {{amount}}.',masterApprovedGeneric:'Клиент подтвердил объём работ и сумму {{amount}}.',agreedScope:'Согласованный объём',additionalConsent:'Дополнительные работы согласуйте с клиентом до их начала.',
  workHub:'Работа',application:'Анкета',disputes:'Мои обращения',online:'Вы онлайн',off:'Вы офлайн',connected:'Соединение активно',disconnected:'Нет соединения',geoDenied:'Нет доступа к геолокации',goOnline:'Стать онлайн',goOffline:'Выйти',clientAccount:'Личный кабинет клиента',profile:'Профиль',planned:'Плановые',
  incoming:'Новая заявка',urgentDistance:'Срочно · {{distance}} км от вас',acceptOffer:'Принять заявку',addressAfter:'Точный адрес — после принятия',seconds:'{{seconds}} с',
  reconciling:'Обновляем состояние заказа. Действия доступны после проверки связи.',
  directCreateNote:'Стоимость работы, материалов и выезда мастер укажет в смете после осмотра. Согласуйте итог до начала работы.',directPayment:'Оплата напрямую мастеру после работы',directCancelNote:'До фактического выезда отмена бесплатна. После выезда — 2 500 ₸ напрямую мастеру за выезд.',findMaster:'Найти мастера',
  approvedBadge:'{{amount}} · согласовано',order:'Ваш заказ',back:'Назад',help:'Помощь с заказом',call:'Позвонить мастеру',callClient:'Позвонить клиенту',
  work:'Работа',materials:'Материалы',callout:'Выезд',total:'Итого',scope:'Что будет сделано',
  searching:'Ищем мастера рядом',assigned:'Мастер найден',enroute:'Мастер в пути',inspection:'Мастер на месте',
  quote:'Согласуйте стоимость',approved:'Стоимость согласована',working:'Работа выполняется',done:'Проверьте результат',closed:'Результат принят',cancelled:'Заказ отменён',nomatch:'Нет свободных мастеров',
  approvedNote:'Мастер получил ваше согласие и скоро начнёт работу.',inspectionNote:'Мастер осмотрит задачу и подготовит смету. Стоимость согласуете до начала работ.',
  quoteNote:'Оплатите напрямую мастеру после выполнения. Приёмка результата не подтверждает оплату.',doneNote:'Проверьте выполненную работу. Если есть проблема, обратитесь за помощью.',
  closedNote:'Спасибо! Расчёт происходит напрямую с мастером. Отзыв необязателен.',
  approve:'Согласовать · {{amount}}',accept:'Принять работу',cancel:'Отменить заказ',confirmCancel:'Подтвердить отмену',stay:'Вернуться к заказу',
  freeCancel:'Отмена до фактического выезда — бесплатно.',paidCancel:'За выезд — {{amount}} напрямую мастеру. Работа и материалы не начисляются.',
  cancelAmount:'К оплате за выезд',offline:'Нет связи. Показано последнее полученное состояние.',retry:'Повторить',loading:'Загрузка…',
  pending:'Ожидает вашего решения',newQuote:'Предложите стоимость',newQuoteNote:'Укажите работу, материалы и выезд. Клиент согласует итог до начала работы.',
  sendQuote:'Отправить · {{amount}}',waiting:'Ждём согласования',ready:'Можно начинать',start:'Начать работу',complete:'Работа выполнена',
  onway:'Выехал к клиенту',onsite:'Я на месте',waitingAcceptance:'Ждём приёмку клиента',waitingNote:'Клиент проверяет результат. Приёмка выполняется только клиентом.',
  comment:'Состав работ',editQuote:'Изменить смету',quoteChanges:'Изменение сметы отменит прежнее согласие клиента.',
  confirmed:'Клиент согласовал стоимость',save:'Сохранить',rating:'Оцените мастера',review:'Комментарий к отзыву',sendReview:'Отправить отзыв',reviewThanks:'Спасибо за отзыв!',
  orders:'Мои заказы',date:'Дата',newOrder:'Создать заявку',support:'Поддержка',error:'Не удалось загрузить заказ',
  moneyUnknown:'Стоимость после осмотра',orderNumber:'Заказ №{{id}}',submitBusy:'Отправка…',skip:'Пропустить',
};
export type CopyKey = keyof typeof ru;
const kk:Record<CopyKey,string>={
  createSubmissionInvalid:'Жібермес бұрын міндетті өрістерді, мәтін ұзындығын және жүктелген фотосуреттерді тексеріңіз.',checkSubmission:'Жіберуді тексеру',checkSubmissionBusy:'Жіберуді тексеріп жатырмыз…',createOutcomeKeyedHelp:'Қайталау сол сұрау нөмірін пайдаланады және бірінші әрекет сақталмаса, бастапқы тапсырысты жасауды аяқтауы мүмкін. Бұл нөмір үшін екінші тапсырыс жасалмайды. Тапсырыстарыңыз бен қолдау қызметі де қолжетімді.',createOutcomeUnknown:'Жіберу нәтижесі әзірге белгісіз',createOutcomeHelp:'Тапсырыс жасалған болуы мүмкін. Тапсырыстарыңызды тексеріңіз немесе қолдау қызметіне хабарласыңыз. Қайталанған тапсырыс болмауы үшін қайта жіберу әзірге қолжетімсіз.',createOutcomeStorage:'Бұл браузерде жіберу күйі сақталмады. Бетті жаңартпаңыз; жаңартқаннан кейін алдымен тапсырыстарыңызды тексеріңіз.',createOutcomeConfirmed:'Тапсырыс жасалды',openCreatedOrder:'Жасалған тапсырысты ашу',
  desktopApprovedNote:'Бағасы келісілді. Шебердің жұмысты бастауын күтіп отырмыз.',desktopApprovedStatus:'Бағасы келісілді',approvedWorkMaterials:'Жұмыс пен материалдар',addressEntrance:'Кіреберіс',addressFloor:'Қабат',addressApartment:'Пәтер',approvedChangeNote:'Жұмыс немесе материалдар өзгерсе, шебер жаңа смета жіберіп, келісіміңізді алуы керек.',masterApprovedNamed:'Тапсырыс беруші {{name}} жұмыс көлемін және {{amount}} сомасын растады.',masterApprovedGeneric:'Тапсырыс беруші жұмыс көлемін және {{amount}} сомасын растады.',agreedScope:'Келісілген жұмыс көлемі',additionalConsent:'Қосымша жұмыстарды бастамас бұрын тапсырыс берушінің келісімін алыңыз.',
  workHub:'Жұмыс',application:'Өтінім',disputes:'Менің өтініштерім',online:'Онлайнсыз',off:'Офлайнсыз',connected:'Байланыс белсенді',disconnected:'Байланыс жоқ',geoDenied:'Геолокацияға рұқсат жоқ',goOnline:'Онлайн болу',goOffline:'Шығу',clientAccount:'Тапсырыс берушінің кабинеті',profile:'Профиль',planned:'Жоспарланған',
  incoming:'Жаңа тапсырыс',urgentDistance:'Шұғыл · сізден {{distance}} км',acceptOffer:'Тапсырысты қабылдау',addressAfter:'Нақты мекенжай қабылдағаннан кейін ашылады',seconds:'{{seconds}} с',
  reconciling:'Тапсырыс күйі жаңартылуда. Әрекеттер байланыс тексерілгеннен кейін қолжетімді.',
  directCreateNote:'Шебер тексеруден кейін жұмыстың, материалдардың және келудің құнын сметада көрсетеді. Жалпы соманы жұмыс басталғанға дейін келісіңіз.',directPayment:'Жұмыстан кейін шеберге тікелей төлеу',directCancelNote:'Шебер жолға шыққанға дейін тоқтату тегін. Жолға шыққаннан кейін келуі үшін 2 500 ₸ тікелей шеберге төленеді.',findMaster:'Шебер табу',
  approvedBadge:'{{amount}} · келісілді',order:'Тапсырысыңыз',back:'Артқа',help:'Тапсырыс бойынша көмек',call:'Шеберге қоңырау шалу',callClient:'Тапсырыс берушіге қоңырау шалу',
  work:'Жұмыс',materials:'Материалдар',callout:'Келу',total:'Барлығы',scope:'Орындалатын жұмыс',
  searching:'Жақын маңнан шебер іздеп жатырмыз',assigned:'Шебер табылды',enroute:'Шебер жолда',inspection:'Шебер келді',
  quote:'Құнын келісіңіз',approved:'Құны келісілді',working:'Жұмыс орындалып жатыр',done:'Нәтижені тексеріңіз',closed:'Нәтиже қабылданды',cancelled:'Тапсырыс тоқтатылды',nomatch:'Бос шебер жоқ',
  approvedNote:'Шебер келісіміңізді алды, жақында жұмысқа кіріседі.',inspectionNote:'Шебер тапсырманы қарап, смета дайындайды. Құнын жұмыс басталғанға дейін келісесіз.',
  quoteNote:'Жұмыстан кейін шеберге тікелей төлеңіз. Нәтижені қабылдау төлемді растамайды.',doneNote:'Орындалған жұмысты тексеріңіз. Мәселе болса, көмекке жүгініңіз.',
  closedNote:'Рақмет! Төлем шеберге тікелей жасалады. Пікір қалдыру міндетті емес.',
  approve:'Келісу · {{amount}}',accept:'Жұмысты қабылдау',cancel:'Тапсырысты тоқтату',confirmCancel:'Тоқтатуды растау',stay:'Тапсырысқа оралу',
  freeCancel:'Шебер жолға шыққанға дейін тоқтату тегін.',paidCancel:'Шебердің келуі үшін {{amount}} тікелей шеберге төленеді. Жұмыс пен материалдар есептелмейді.',
  cancelAmount:'Келуі үшін төленетін сома',offline:'Байланыс жоқ. Соңғы алынған күй көрсетілген.',retry:'Қайталау',loading:'Жүктелуде…',
  pending:'Шешіміңізді күтуде',newQuote:'Құнын ұсыныңыз',newQuoteNote:'Жұмыстың, материалдардың және келудің құнын көрсетіңіз. Тапсырыс беруші жалпы соманы жұмыс басталғанға дейін келіседі.',
  sendQuote:'Жіберу · {{amount}}',waiting:'Келісімді күтудеміз',ready:'Жұмысқа кірісуге болады',start:'Жұмысты бастау',complete:'Жұмыс орындалды',
  onway:'Тапсырыс берушіге шықтым',onsite:'Келдім',waitingAcceptance:'Тапсырыс берушінің қабылдауын күтудеміз',waitingNote:'Тапсырыс беруші нәтижені тексеруде. Жұмысты тек тапсырыс беруші қабылдайды.',
  comment:'Жұмыс құрамы',editQuote:'Сметаны өзгерту',quoteChanges:'Смета өзгерсе, бұрынғы келісім жойылады.',
  confirmed:'Тапсырыс беруші құнын келісті',save:'Сақтау',rating:'Шеберді бағалаңыз',review:'Пікір мәтіні',sendReview:'Пікір жіберу',reviewThanks:'Пікіріңізге рақмет!',
  orders:'Менің тапсырыстарым',date:'Күні',newOrder:'Тапсырыс жасау',support:'Қолдау',error:'Тапсырыс жүктелмеді',
  moneyUnknown:'Құны тексеруден кейін',orderNumber:'№{{id}} тапсырыс',submitBusy:'Жіберілуде…',skip:'Өткізу',
};
const en:Record<CopyKey,string>={
  createSubmissionInvalid:'Check required fields, text length and uploaded photos before submitting.',checkSubmission:'Check submission',checkSubmissionBusy:'Checking submission…',createOutcomeKeyedHelp:'Retry uses the same request identity and may complete the original creation if the first attempt was not committed. It does not create a second order for that identity. Your orders and support are also available.',createOutcomeUnknown:'The submission outcome is still unknown',createOutcomeHelp:'The request may have been created. Check your orders or contact support. Resubmission is unavailable for now to avoid creating a duplicate.',createOutcomeStorage:'This browser could not save the submission status. Keep this page open; after a reload, check your orders first.',createOutcomeConfirmed:'Request created',openCreatedOrder:'Open the created request',
  desktopApprovedNote:'Price approved. Waiting for the specialist to start work.',desktopApprovedStatus:'Price approved',approvedWorkMaterials:'Work and materials',addressEntrance:'Entrance',addressFloor:'Floor',addressApartment:'Apartment',approvedChangeNote:'If the work or materials change, the specialist must send a new quote and get your approval.',masterApprovedNamed:'Customer {{name}} approved the scope of work and the amount {{amount}}.',masterApprovedGeneric:'The customer approved the scope of work and the amount {{amount}}.',agreedScope:'Agreed scope',additionalConsent:'Get the customer’s approval for additional work before it begins.',
  workHub:'Work',application:'Application',disputes:'My support requests',online:'You are online',off:'You are offline',connected:'Connected',disconnected:'Disconnected',geoDenied:'Location access denied',goOnline:'Go online',goOffline:'Go offline',clientAccount:'Customer account',profile:'Profile',planned:'Scheduled',
  incoming:'New request',urgentDistance:'Urgent · {{distance}} km away',acceptOffer:'Accept request',addressAfter:'Exact address available after acceptance',seconds:'{{seconds}} s',
  reconciling:'Refreshing the order. Actions will be available after connection is verified.',
  directCreateNote:'After inspection, the specialist will quote work, materials and callout costs. Approve the total before work starts.',directPayment:'Pay the specialist directly after the work',directCancelNote:'Cancellation is free before departure. After departure, pay 2,500 ₸ directly to the specialist for the callout.',findMaster:'Find a specialist',
  approvedBadge:'{{amount}} · approved',order:'Your order',back:'Back',help:'Order help',call:'Call the specialist',callClient:'Call the customer',
  work:'Work',materials:'Materials',callout:'Callout',total:'Total',scope:'Scope of work',
  searching:'Finding a specialist nearby',assigned:'Specialist found',enroute:'Specialist on the way',inspection:'Specialist has arrived',
  quote:'Approve the quote',approved:'Price approved',working:'Work in progress',done:'Check the result',closed:'Work accepted',cancelled:'Order cancelled',nomatch:'No specialists available',
  approvedNote:'The specialist received your approval and will start soon.',inspectionNote:'The specialist will inspect the task and prepare a quote. Approve the price before work starts.',
  quoteNote:'Pay the specialist directly after the work. Accepting the result does not confirm payment.',doneNote:'Check the completed work. Request help if there is a problem.',
  closedNote:'Thank you! Pay the specialist directly. Leaving a review is optional.',
  approve:'Approve · {{amount}}',accept:'Accept work',cancel:'Cancel order',confirmCancel:'Confirm cancellation',stay:'Return to order',
  freeCancel:'Cancellation is free before the specialist departs.',paidCancel:'Pay {{amount}} directly to the specialist for the callout. Work and materials are not charged.',
  cancelAmount:'Callout amount due',offline:'No connection. Showing the last received state.',retry:'Retry',loading:'Loading…',
  pending:'Waiting for your decision',newQuote:'Propose a price',newQuoteNote:'Enter work, materials and callout costs. The customer approves the total before work starts.',
  sendQuote:'Send · {{amount}}',waiting:'Waiting for approval',ready:'Ready to start',start:'Start work',complete:'Work completed',
  onway:'Departed for customer',onsite:'I have arrived',waitingAcceptance:'Waiting for customer acceptance',waitingNote:'The customer is checking the result. Only the customer can accept the work.',
  comment:'Scope of work',editQuote:'Revise quote',quoteChanges:'Revising the quote clears the previous approval.',
  confirmed:'The customer approved the price',save:'Save',rating:'Rate the specialist',review:'Review comment',sendReview:'Submit review',reviewThanks:'Thank you for your review!',
  orders:'My orders',date:'Date',newOrder:'Create request',support:'Support',error:'Unable to load the order',
  moneyUnknown:'Price after inspection',orderNumber:'Order #{{id}}',submitBusy:'Sending…',skip:'Skip',
};
export const dictionaries={ru,kk,en};
export function translate(locale:Locale,key:CopyKey,params:Record<string,string|number>={}) {
  return dictionaries[locale][key].replace(/\{\{(\w+)\}\}/g,(_,name:string)=>String(params[name]??''));
}
export function money(locale:Locale,amount:number) {
  return `${new Intl.NumberFormat(locale==='kk'?'kk-KZ':locale==='ru'?'ru-KZ':'en-GB',{maximumFractionDigits:0}).format(amount)} ₸`;
}
export function reviewCount(locale:Locale,count:number) {
  const form=new Intl.PluralRules(locale).select(count);
  const words=locale==='ru'?{one:'отзыв',few:'отзыва',many:'отзывов',other:'отзыва'}:locale==='en'?{one:'review',other:'reviews'}:{other:'пікір'};
  return `${count} ${(words as Record<string,string>)[form]??words.other}`;
}
