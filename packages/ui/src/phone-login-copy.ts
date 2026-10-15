import type {Locale} from './locale-data';
const ru = {
  "networkError": "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз.",
  "phoneTitle": "Войдите по номеру телефона",
  "phoneSubtitle": "Отправим код подтверждения в SMS.",
  "phonePlaceholder": "707 123 45 67",
  "termsPrefix": "Продолжая, вы соглашаетесь с",
  "termsLink": "условиями сервиса",
  "getCodeButton": "Получить код",
  "changeNumber": "Изменить номер",
  "smsTitle": "Код из SMS",
  "smsSubtitle": "Отправили на {{phone}}",
  "resendIn": "Отправить снова через {{time}}",
  "resendNow": "Отправить код повторно",
  "loginButton": "Войти",
  "pageTitle": "Войти в MasterQala",
  "pageSubtitle": "Один аккаунт для заказов и работы мастером.",
  "phoneLabel": "Номер телефона",
  "confirmTitle": "Подтверждение номера",
  "codeLabel": "Код из SMS",
  "codeHelp": "Введите 6 цифр из сообщения.",
  "country": "Казахстан · +7",
  "accountTitle": "Один номер — ваш аккаунт",
  "accountDescription": "Ваши заказы и профиль сохраняются. Пароль не нужен.",
  "requesting": "Отправка кода…",
  "verifying": "Проверка кода…",
  "phonePanelTitle": "Вход по номеру телефона"
};
const kk:Record<keyof typeof ru,string> = {
  "networkError": "Серверге қосылу мүмкін болмады. Интернет байланысын тексеріп, қайталап көріңіз.",
  "pageTitle": "MasterQala-ға кіру",
  "pageSubtitle": "Тапсырыс беруге және шебер болып жұмыс істеуге арналған бір аккаунт.",
  "phoneTitle": "Телефон нөмірі арқылы кіріңіз",
  "phoneLabel": "Телефон нөмірі",
  "phoneSubtitle": "Растау кодын SMS арқылы жібереміз.",
  "phonePlaceholder": "701 123 45 67",
  "confirmTitle": "Нөмірді растау",
  "codeLabel": "SMS коды",
  "codeHelp": "Хабарламадағы 6 санды енгізіңіз.",
  "country": "Қазақстан · +7",
  "accountTitle": "Бір нөмір — сіздің аккаунтыңыз",
  "accountDescription": "Тапсырыстарыңыз бен профиліңіз сақталады. Құпиясөз қажет емес.",
  "requesting": "Код жіберілуде…",
  "verifying": "Код тексерілуде…",
  "getCodeButton": "Код алу",
  "smsTitle": "SMS кодын енгізіңіз",
  "smsSubtitle": "Код {{phone}} нөміріне жіберілді.",
  "resendIn": "{{time}} уақыттан кейін қайта жіберу",
  "resendNow": "Кодты қайта жіберу",
  "loginButton": "Кіру",
  "changeNumber": "Нөмірді өзгерту",
  "termsPrefix": "Жалғастыру арқылы сіз",
  "termsLink": "қызмет шарттарымен келісесіз",
  "phonePanelTitle": "Телефон нөмірімен кіру"
};
const en:Record<keyof typeof ru,string> = {
  "networkError": "Unable to reach the server. Check your internet connection and try again.",
  "pageTitle": "Sign in to MasterQala",
  "pageSubtitle": "One account to book services and work as a master.",
  "phoneTitle": "Sign in with your phone number",
  "phoneLabel": "Phone number",
  "phoneSubtitle": "We will send a confirmation code by SMS.",
  "phonePlaceholder": "701 123 45 67",
  "confirmTitle": "Confirm your number",
  "codeLabel": "SMS code",
  "codeHelp": "Enter the 6 digits from the message.",
  "country": "Kazakhstan · +7",
  "accountTitle": "One number, your account",
  "accountDescription": "Your orders and profile are saved. No password needed.",
  "requesting": "Sending code…",
  "verifying": "Checking code…",
  "getCodeButton": "Get code",
  "smsTitle": "Enter the SMS code",
  "smsSubtitle": "Code sent to {{phone}}.",
  "resendIn": "Send again in {{time}}",
  "resendNow": "Send code again",
  "loginButton": "Sign in",
  "changeNumber": "Change number",
  "termsPrefix": "By continuing, you agree to the",
  "termsLink": "terms of service",
  "phonePanelTitle": "Sign in by phone"
};
const phoneLoginCopy={ru,kk,en};
export function phoneLoginText(language:Locale,key:string,values?:Record<string,string>):string {
  const name=key.startsWith('auth.')?key.slice(5):'';
  const copy=phoneLoginCopy[language];
  if (!Object.hasOwn(copy,name)) return key;
  return copy[name as keyof typeof ru].replace(/{{(\w+)}}/g,(placeholder:string,field:string)=>values?.[field]??placeholder);
}
