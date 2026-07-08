# Стена

Публичная веб-стена анонимных стикеров с настроением. Стикер живёт 7 дней и
исчезает. Полное ТЗ — `stena-project-spec.md` в этом репозитории (или в
`Downloads/stena-project-spec.md`, откуда оно изначально взято).

Реализованы **Фаза 1** (ядро + базовая модерация) и **Фаза 2** (полноценная
защита): жалобы с авто-скрытием, словарь запрещённых слов, rate limiting,
админ-панель, юридические страницы. Фаза 3 (монетизация) — по ТЗ, следующим
шагом после подтверждения, что эта фаза работает.

## Стек

Next.js (App Router) + TypeScript + Tailwind CSS v4, Supabase (Postgres +
Realtime), OpenAI Moderation API.

## Настройка с нуля

### 1. Supabase-проект

1. Создайте проект на [supabase.com](https://supabase.com) (бесплатный тариф).
2. В SQL Editor выполните по очереди `supabase/migrations/0001_init.sql` и
   `supabase/migrations/0002_reports.sql` — создадут все таблицы, RLS-политики
   и RPC-функции (`like_sticker`, `report_sticker`).
3. Realtime должен быть включён для таблицы `stickers` (Database ->
   Replication -> `stickers` -> вкл.).
4. Возьмите `Project URL`, `anon public` key и `service_role` key
   (Settings -> API).

### 2. OpenAI API key

Получите ключ на [platform.openai.com](https://platform.openai.com/api-keys).
Moderation API бесплатен для текста.

### 3. Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # только сервер, не NEXT_PUBLIC_!
OPENAI_API_KEY=...
ADMIN_PASSWORD=...              # пароль для /admin (HTTP Basic Auth)
```

`SUPABASE_SERVICE_ROLE_KEY` используется только в Route Handlers
(`app/api/**`) и в Server Components — никогда не уходит в браузер. Файл
`lib/supabase/admin.ts` защищён импортом `server-only`, чтобы случайное
использование в клиентском компоненте ломало сборку, а не утекало в рантайме.

### 4. Запуск локально

```bash
npm install
npm run dev
```

Откройте http://localhost:3000. Админ-панель — http://localhost:3000/admin
(браузер спросит логин/пароль; логин можно любой, важен пароль —
`ADMIN_PASSWORD`).

### 5. Автоудаление истёкших стикеров (cron)

Инструкции и код — `supabase/functions/expire-stickers/README.md`. Кратко:
деплой Edge Function по расписанию (или `pg_cron`, если он включён в проекте) —
раз в час удаляет из БД стикеры с `expires_at < now()`.

### 6. Деплой

- Frontend — Vercel (`vercel.com/new`), прописать те же переменные окружения
  в Project Settings -> Environment Variables (включая `ADMIN_PASSWORD`).
- Backend — Supabase Cloud, уже настроен на шаге 1.
- Basic Auth админ-панели полагается на HTTPS (пароль иначе идёт в открытом
  виде) — на Vercel HTTPS включён по умолчанию, для самостоятельного хостинга
  проверьте это отдельно.

## Структура

```
app/
  page.tsx              — Server Component: начальная загрузка стикеров + лайков сессии
  admin/page.tsx         — очередь модерации (жалобы, скрытые стикеры)
  terms/page.tsx         — Условия использования
  privacy/page.tsx       — Политика конфиденциальности
  api/stickers/route.ts                 — POST: rate limit, словарь слов, модерация, insert
  api/stickers/[id]/like/route.ts       — POST: атомарный лайк (RPC like_sticker)
  api/stickers/[id]/report/route.ts     — POST: жалоба (RPC report_sticker, авто-скрытие на 3-й)
  api/admin/stickers/[id]/route.ts      — POST: действия модератора (approve/hide/delete)
components/
  WallCanvas.tsx  — холст: realtime-подписка, виртуализация рендера, скролл
  StickerCard.tsx — карточка стикера, эффект выцветания, кнопка "Пожаловаться"
  Composer.tsx    — нижняя панель создания стикера
  Header.tsx      — плавающая пилюля с счётчиком
  admin/ModerationQueueItem.tsx — карточка очереди модерации с действиями
lib/
  supabase/admin.ts   — service role client (server-only)
  supabase/public.ts  — anon client для Server Components
  supabase/client.ts  — anon client для браузера (realtime)
  moderation.ts       — OpenAI Moderation API
  wordFilter.ts       — простой словарь запрещённых слов рус/каз (дополнение к OpenAI)
  rateLimit.ts        — лимит публикаций на сессию в час
  reportReasons.ts     — причины жалоб (используются и на клиенте, и на сервере)
  layout.ts           — подбор позиции стикера без наложений
  moods.ts            — палитра и подписи настроений
  session.ts          — анонимный session-токен
proxy.ts              — анонимный session-токен + Basic Auth для /admin и /api/admin
supabase/
  migrations/0001_init.sql   — базовая схема + RLS + RPC (Фаза 1)
  migrations/0002_reports.sql — RPC report_sticker (Фаза 2)
  functions/expire-stickers/ — Edge Function для автоудаления
```

## Модерация и защита (Фаза 2)

- **Порядок проверки** при создании стикера: длина -> rate limit (не больше
  8 постов на сессию в час) -> словарь запрещённых слов -> OpenAI Moderation
  API. Каждая проверка дешевле следующей, поэтому дорогой вызов OpenAI идёт
  последним.
- **Словарь слов** (`lib/wordFilter.ts`) — стартовый список, не исчерпывающий.
  Расширяйте его силами модераторов/носителей языка по мере необходимости —
  сам ТЗ отмечает, что покрытие рус/каз сленга у OpenAI слабое.
- **Жалобы**: у каждого стикера есть кнопка 🚩. При достижении 3 жалоб
  `report_sticker` атомарно скрывает стикер (`is_hidden = true`) — он
  перестаёт быть виден в `SELECT` по RLS и попадает в очередь `/admin`.
- **Известное ограничение**: если сторонний посетитель уже открыл стену и
  сообщение скрывается чужой третьей жалобой, у него карточка пропадёт не
  сразу через Realtime (Supabase не шлёт UPDATE, если новая версия строки не
  проходит RLS), а при следующей перезагрузке страницы. Для MVP это приемлемо.
- **Админ-панель** (`/admin`, Basic Auth): показывает все стикеры с жалобами
  и/или скрытые, с текстом и причинами жалоб. Действия — «Одобрить» (снять
  жалобы, вернуть на стену), «Скрыть», «Удалить навсегда».

## Известные ограничения (ожидаемо, не баг)

- Магазин декораций, спонсорские стикеры, Kaspi — Фаза 3.
- Комментарии — кнопка-заглушка (по ТЗ).
- Полноценный pan/zoom холст сознательно не реализован — см. раздел 4 ТЗ.
- Юридические страницы (`/terms`, `/privacy`) содержат содержательный черновик
  реальных правил, но не заменяют проверку юристом перед коммерческим запуском.
