-- Лимиты по IP поверх лимитов по сессии. Сессия — это просто cookie: скрипт,
-- который её не присылает, получает новую на каждый запрос, и лимиты по
-- session_id для него не работают. Поэтому считаем ещё и по IP.
--
-- Сам IP не хранится: в key_hash лежит HMAC-SHA256(секрет, дата + IP),
-- посчитанный на сервере (lib/ipRateLimit.ts). Дата входит в хэш, так что
-- одно и то же устройство в разные дни даёт разные хэши — связать
-- активность между днями нельзя. События старше суток удаляются.

create table if not exists rate_limit_events (
  id bigserial primary key,
  bucket text not null,      -- 'post' | 'report' | 'like'
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on rate_limit_events (bucket, key_hash, created_at);

create index if not exists rate_limit_events_created_idx
  on rate_limit_events (created_at);

alter table rate_limit_events enable row level security;
revoke all on table rate_limit_events from anon, authenticated;
revoke all on sequence rate_limit_events_id_seq from anon, authenticated;

-- Атомарно: если в окне уже p_limit событий — false (лимит исчерпан), иначе
-- записывает событие и возвращает true. Advisory lock на пару (bucket, key)
-- не даёт двум параллельным запросам одновременно пройти последнюю "дырку".
create or replace function hit_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key_hash, 0));

  select count(*) into v_count
  from rate_limit_events
  where bucket = p_bucket
    and key_hash = p_key_hash
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into rate_limit_events (bucket, key_hash) values (p_bucket, p_key_hash);

  -- Изредка подчищаем старое, чтобы таблица не росла (дополнительно к
  -- уборке в Edge Function expire-stickers).
  if random() < 0.01 then
    delete from rate_limit_events where created_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke execute on function hit_rate_limit(text, text, int, int) from public, anon, authenticated;

-- Явно оставляем доступ серверу (service_role). В Supabase он и так есть
-- через default privileges, но после revoke ... from public лучше не
-- полагаться на это молча — в том числе для функций из 0009.
grant all on table rate_limit_events to service_role;
grant usage, select on sequence rate_limit_events_id_seq to service_role;
grant execute on function hit_rate_limit(text, text, int, int) to service_role;
grant execute on function report_sticker(uuid, text, text) to service_role;
grant execute on function like_sticker(uuid, text) to service_role;
grant execute on function get_random_sticker(uuid[]) to service_role;
