import type {Locale} from '@masterqala/ui';
const ru = {
  missing:'Страница не найдена', about:'О нас', faq:'Вопросы', master:'Стать мастером', login:'Войти', menu:'Меню', navigation:'Навигация',
  tagline:'Заявка, согласование работ и приёмка в одном месте', contactsUnavailable:'Контакты службы поддержки пока не опубликованы.',
  unavailable:'Переход в приложение пока не настроен.', request:'Оставить заявку', view:'Подробнее', categories:'Категории услуг',
  loading:'Загрузка…', readError:'Не удалось загрузить данные. Это не означает, что услуг нет.', retry:'Попробовать снова', home:'На главную', empty:'Категории пока не опубликованы.',
};
type Copy = typeof ru;
const kk:Copy = {
  missing:'Бет табылмады', about:'Біз туралы', faq:'Сұрақтар', master:'Шебер болу', login:'Кіру', menu:'Мәзір', navigation:'Навигация',
  tagline:'Өтінім, жұмысты келісу және қабылдау бір жерде', contactsUnavailable:'Қолдау қызметінің байланыстары әлі жарияланбаған.',
  unavailable:'Қолданбаға өту әлі бапталмаған.', request:'Өтінім беру', view:'Толығырақ', categories:'Қызмет санаттары',
  loading:'Жүктелуде…', readError:'Деректерді жүктеу мүмкін болмады. Бұл қызметтер жоқ дегенді білдірмейді.', retry:'Қайталап көру', home:'Басты бетке', empty:'Санаттар әлі жарияланбаған.',
};
const en:Copy = {
  missing:'Page not found', about:'About', faq:'Questions', master:'Become a master', login:'Sign in', menu:'Menu', navigation:'Navigation',
  tagline:'Request, agree on the work and accept the result in one place', contactsUnavailable:'Support contact details have not been published yet.',
  unavailable:'The application link has not been configured yet.', request:'Create a request', view:'Learn more', categories:'Service categories',
  loading:'Loading…', readError:'Data could not be loaded. This does not mean services are unavailable.', retry:'Try again', home:'Home', empty:'Categories have not been published yet.',
};
export const siteText=(language:Locale,key:keyof Copy)=>({ru,kk,en})[language][key];
