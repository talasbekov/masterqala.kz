// Next.js не даёт типов для side-effect импорта CSS (import './globals.css')
// из коробки в этой конфигурации TypeScript — без этого объявления сборка
// падает с TS2882 на каждом импорте *.css.
declare module '*.css';
