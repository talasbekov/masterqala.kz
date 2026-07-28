import { getContactEmail, getContactPhone } from '@/lib/env';

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink">О MasterQala</h1>
      <p className="mt-4 text-lg text-ink-soft">
        MasterQala — сервис вызова мастеров бытовых услуг на дом. Мы работаем в Астане (пилотный запуск — Есильский
        район) и соединяем клиентов с проверенными мастерами: сантехниками, электриками, специалистами по ремонту
        бытовой техники и мелкому ремонту.
      </p>
      <p className="mt-4 text-lg text-ink-soft">
        Каждый мастер проходит ручную проверку перед тем, как начать принимать заказы. Мастер оставляет себе 100%
        стоимости выполненных работ — платформа не берёт комиссию с работы.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-ink">Контакты</h2>
      <p className="mt-2 text-ink-soft">{getContactPhone()}</p>
      <p className="text-ink-soft">{getContactEmail()}</p>
    </main>
  );
}
