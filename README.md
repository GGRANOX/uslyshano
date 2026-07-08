# Стена

Публичная веб-стена анонимных стикеров с настроением. Стикер живёт 7 дней и
исчезает. Полное ТЗ — `stena-project-spec.md` в этом репозитории (или в
`Downloads/stena-project-spec.md`, откуда оно изначально взято).

Это реализация **Фазы 1** (ядро + базовая модерация): создание стикера,
живая лента через Supabase Realtime, простая раскладка на холсте с избеганием
наложений, модерация через OpenAI, лайки, автоудаление по `expires_at`.
Фазы 2 (жалобы/rate limiting/админка) и 3 (монетизация) — по ТЗ, следующим
шагом после подтверждения, что эта фаза работает.

## Стек

Next.js (App Router) + TypeScript + Tailwind CSS v4, Supabase (Postgres +
Realtime), OpenAI Moderation API.

## Настройка с нуля

### 1. Supabase-проект

1. Создайте проект на [supabase.com](https://supabase.com) (бесплатный тариф).
2. В SQL Editor выполните `supabase/migrations/0001_init.sql` — создаст все
   таблицы, RLS-политики и функцию `like_sticker`.
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

Откройте http://localhost:3000.

### 5. Автоудаление истёкших стикеров (cron)

Инструкции и код — `supabase/functions/expire-stickers/README.md`. Кратко:
деплой Edge Function по расписанию (или `pg_cron`, если он включён в проекте) —
раз в час удаляет из БД стикеры с `expires_at < now()`.

### 6. Деплой

- Frontend — Vercel (`vercel.com/new`), прописать те же переменные окружения
  в Project Settings -> Environment Variables.
- Backend — Supabase Cloud, уже настроен на шаге 1.

## Структура

```
app/
  page.tsx              — Server Component: начальная загрузка стикеров + лайков сессии
  api/stickers/route.ts — POST: валидация, модерация, позиционирование, insert
  api/stickers/[id]/like/route.ts — POST: атомарный лайк (RPC like_sticker)
components/
  WallCanvas.tsx  — холст: realtime-подписка, виртуализация рендера, скролл
  StickerCard.tsx — карточка стикера, эффект выцветания за 24ч до удаления
  Composer.tsx    — нижняя панель создания стикера
  Header.tsx      — плавающая пилюля с счётчиком
lib/
  supabase/admin.ts   — service role client (server-only)
  supabase/public.ts  — anon client для Server Components
  supabase/client.ts  — anon client для браузера (realtime)
  moderation.ts       — OpenAI Moderation API
  layout.ts           — подбор позиции стикера без наложений
  moods.ts            — палитра и подписи настроений
  session.ts          — анонимный session-токен
middleware.ts         — выдаёт анонимный session-токен (httpOnly cookie) при первом визите
supabase/
  migrations/0001_init.sql   — полная схема + RLS + RPC
  functions/expire-stickers/ — Edge Function для автоудаления
```

## Известные ограничения Фазы 1 (ожидаемо, не баг)

- Жалобы, словарь запрещённых слов, rate limiting, админка — Фаза 2.
- Магазин декораций, спонсорские стикеры, Kaspi — Фаза 3.
- Комментарии — кнопка-заглушка (по ТЗ).
- Полноценный pan/zoom холст сознательно не реализован — см. раздел 4 ТЗ.
