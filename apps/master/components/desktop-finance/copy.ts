import type { Locale } from '@masterqala/ui';

const ru = {
  wallet: 'Расчёты по заказам', credits: 'Отклики и кредиты', navigation: 'Расчёты и отклики',
  status: 'Операции через платформу отключены', back: 'К профилю', work: 'Перейти к работе',
  history: 'Открыть мои заказы', walletTitle: 'Вывод денег недоступен',
  walletDescription: 'В этом кабинете нельзя пополнить баланс, сохранить платёжные реквизиты или запросить выплату.',
  walletContext: 'В бесплатном пилоте платформа не принимает оплату и не формирует баланс для вывода. Расчёты за выполненную работу происходят напрямую между клиентом и мастером.',
  walletAction: 'Вывод недоступен', walletNote: 'Сумма заказа — условие работы, а не подтверждение банковского перевода.',
  creditTitle: 'Покупка кредитов недоступна', creditDescription: 'В бесплатном пилоте отклики на плановые заявки не требуют покупки кредитов.',
  creditContext: 'Условия своего предложения можно проверить в карточке заявки. Выбор мастера остаётся за клиентом.',
  creditAction: 'Покупка недоступна', creditNote: 'Кнопка отклика доступна только там, где заявка ещё принимает предложения и выполнены действующие условия.',
  available: 'Что доступно сейчас', historyDescription: 'Проверяйте статусы и сохранённые условия своих заказов. История заказов не является историей платежей.',
  workDescription: 'Просматривайте доступные заявки и отправляйте предложения из раздела «Работа».',
  protected: 'Без финансовых операций', protectedDescription: 'На этом экране нет покупки, списания, возврата или выплаты. Банковские реквизиты здесь не запрашиваются.',
};
const kk: Record<keyof typeof ru, string> = {
  wallet: 'Тапсырыс бойынша есеп айырысу', credits: 'Ұсыныстар мен кредиттер', navigation: 'Есеп айырысу және ұсыныстар',
  status: 'Платформа арқылы операциялар өшірілген', back: 'Профильге', work: 'Жұмысқа өту',
  history: 'Тапсырыстарымды ашу', walletTitle: 'Ақша шығару қолжетімсіз',
  walletDescription: 'Бұл кабинетте балансты толтыру, төлем деректемелерін сақтау немесе төлем сұрау мүмкін емес.',
  walletContext: 'Тегін пилотта платформа төлем қабылдамайды және ақша шығару балансын құрмайды. Орындалған жұмыс үшін клиент пен шебер тікелей есеп айырысады.',
  walletAction: 'Ақша шығару қолжетімсіз', walletNote: 'Тапсырыс сомасы — жұмыс шарты, банк аударымының растамасы емес.',
  creditTitle: 'Кредит сатып алу қолжетімсіз', creditDescription: 'Тегін пилотта жоспарлы тапсырыстарға ұсыныс жіберу үшін кредит сатып алу қажет емес.',
  creditContext: 'Өз ұсынысыңыздың шарттарын тапсырыс карточкасынан тексере аласыз. Шеберді клиент таңдайды.',
  creditAction: 'Сатып алу қолжетімсіз', creditNote: 'Ұсыныс жіберу батырмасы тапсырыс әлі ұсыныстар қабылдап, қолданыстағы шарттар орындалғанда ғана қолжетімді.',
  available: 'Қазір не қолжетімді', historyDescription: 'Тапсырыстарыңыздың күйлері мен сақталған шарттарын тексеріңіз. Тапсырыс тарихы төлем тарихы болып саналмайды.',
  workDescription: 'Қолжетімді тапсырыстарды қарап, «Жұмыс» бөлімінен ұсыныс жіберіңіз.',
  protected: 'Қаржылық операцияларсыз', protectedDescription: 'Бұл экранда сатып алу, есептен шығару, қайтару немесе төлеу жоқ. Банк деректемелері сұралмайды.',
};
const en: Record<keyof typeof ru, string> = {
  wallet: 'Order payments', credits: 'Responses and credits', navigation: 'Payments and responses',
  status: 'Platform transactions are disabled', back: 'Back to profile', work: 'Go to work',
  history: 'Open my orders', walletTitle: 'Withdrawals are unavailable',
  walletDescription: 'You cannot top up a balance, save payout details or request a withdrawal in this workspace.',
  walletContext: 'During the free pilot, the platform does not collect payments or build a withdrawal balance. Clients and masters settle payment for completed work directly.',
  walletAction: 'Withdrawal unavailable', walletNote: 'An order amount is a work term, not confirmation of a bank transfer.',
  creditTitle: 'Credit purchases are unavailable', creditDescription: 'During the free pilot, responding to planned requests does not require buying credits.',
  creditContext: 'Check your submitted terms in the request details. The client chooses the master.',
  creditAction: 'Purchase unavailable', creditNote: 'You can respond only while a request accepts proposals and the existing requirements are met.',
  available: 'Available now', historyDescription: 'Check the statuses and saved terms of your orders. Order history is not payment history.',
  workDescription: 'Browse available requests and send proposals from the Work section.',
  protected: 'No financial transactions', protectedDescription: 'This screen does not purchase, charge, refund or pay out funds. It does not ask for bank details.',
};
export const financeCopy = (language: Locale) => ({ ru, kk, en })[language];
