-- Безопасность: закрываем приватные колонки stickers и накрутку жалоб.
--
-- 1) Утечка session_id. Политика "public can read visible stickers" из
--    0001_init.sql открывала anon-ключу ВСЕ колонки stickers. anon-ключ
--    публичный (он в клиентском бандле), поэтому любой мог сделать
--    GET /rest/v1/stickers?select=session_id и получить ключи чужих сессий,
--    а Supabase Realtime рассылал их в каждый браузер в payload'ах. С чужим
--    session_id в cookie можно было пользоваться чужими купленными
--    декорациями, удалять чужие стикеры и т.д.
--
--    Решение — column-level privileges: anon/authenticated могут читать только
--    публичные колонки. RLS-политика (какие СТРОКИ видно) остаётся как была,
--    а это ограничивает, какие КОЛОНКИ. Realtime тоже уважает эти привилегии и
--    не отправляет подписчику колонки, на которые у его роли нет SELECT.
--    service_role (серверные API-роуты) по-прежнему видит всё.
--
--    ВАЖНО для будущих миграций: новая колонка в stickers по умолчанию будет
--    НЕДОСТУПНА anon. Если она публичная — добавьте её отдельным
--    `grant select (новая_колонка) on stickers to anon, authenticated;`.

revoke all on table stickers from anon, authenticated;

grant select (
  id,
  text,
  mood,
  position_x,
  position_y,
  rotation,
  decoration_id,
  is_sponsored,
  sponsor_url,
  is_hidden,
  created_at,
  expires_at
) on table stickers to anon, authenticated;

-- session_id, likes_count, report_count, allow_feature — только service_role.

-- То же для остальных таблиц: запись только через service_role (RLS и так
-- не давала политик на insert/update/delete, это защита второго уровня).
revoke all on table reactions from anon, authenticated;
revoke all on table reports from anon, authenticated;
revoke all on table purchases from anon, authenticated;
revoke insert, update, delete on table decorations from anon, authenticated;

-- get_random_sticker возвращает строку целиком (с session_id) — вызывать её
-- можно только с сервера (app/api/stickers/random/route.ts через service role).
revoke execute on function get_random_sticker(uuid[]) from public, anon, authenticated;
revoke execute on function like_sticker(uuid, text) from public, anon, authenticated;

-- 2) Накрутка жалоб. Раньше report_sticker не знал, кто жалуется: один
--    человек тремя запросами скрывал любой стикер. Теперь одна жалоба на
--    сессию на стикер (как с реакциями).

alter table reports add column if not exists session_id text;

create unique index if not exists reports_sticker_session_uniq
  on reports (sticker_id, session_id)
  where session_id is not null;

create index if not exists reports_session_created_idx
  on reports (session_id, created_at);

drop function if exists report_sticker(uuid, text);

create or replace function report_sticker(
  p_sticker_id uuid,
  p_session_id text,
  p_reason text
)
returns table (report_count int, is_hidden boolean, already_reported boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  insert into reports (sticker_id, session_id, reason)
  values (p_sticker_id, p_session_id, p_reason)
  on conflict (sticker_id, session_id) where session_id is not null do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update stickers s
    set report_count = s.report_count + 1,
        is_hidden = (s.report_count + 1 >= 3) or s.is_hidden
    where s.id = p_sticker_id;
  end if;

  return query
    select s.report_count, s.is_hidden, (v_rows = 0) as already_reported
    from stickers s
    where s.id = p_sticker_id;
end;
$$;

revoke execute on function report_sticker(uuid, text, text) from public, anon, authenticated;
