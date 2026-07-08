# expire-stickers

Edge Function, которая удаляет из таблицы `stickers` все записи с истёкшим
`expires_at`. Ничего не рендерит и не хранит состояние — просто `DELETE`.

## Деплой

```bash
supabase functions deploy expire-stickers --no-verify-jwt
supabase secrets set CRON_SECRET=<случайная-строка>
```

`--no-verify-jwt` нужен, потому что функцию вызывает cron, а не залогиненный
пользователь. Вместо JWT-проверки используется свой секрет в заголовке
`x-cron-secret` (см. `CRON_SECRET` в коде) — так никто посторонний не сможет
дёргать функцию и досрочно чистить стену.

## Расписание (cron)

Самый простой вариант — Supabase Dashboard -> Edge Functions -> expire-stickers
-> "Cron" -> расписание `0 * * * *` (раз в час), с заголовком
`x-cron-secret: <тот же секрет>`.

Альтернатива без Edge Function — `pg_cron` прямо в Postgres (если он включён
в проекте):

```sql
select cron.schedule(
  'expire-stickers',
  '0 * * * *',
  $$ delete from stickers where expires_at < now(); $$
);
```

Оба варианта реально удаляют строки из БД, а не просто скрывают их на клиенте
— как и требует ТЗ.
