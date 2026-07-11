-- Фикс бага из 0001_init.sql: в UPDATE внутри like_sticker колонка
-- likes_count упоминалась без алиаса таблицы, а RETURNS TABLE(likes_count ...)
-- создаёт одноимённую PL/pgSQL-переменную — Postgres не мог понять, что
-- имеется в виду ("column reference likes_count is ambiguous", 42702).
-- Из-за этого любой лайк падал с ошибкой на сервере и не сохранялся.
create or replace function like_sticker(p_sticker_id uuid, p_session_id text)
returns table (likes_count int, already_liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  insert into reactions (sticker_id, session_id)
  values (p_sticker_id, p_session_id)
  on conflict (sticker_id, session_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update stickers s set likes_count = s.likes_count + 1
    where s.id = p_sticker_id;
  end if;

  return query
    select s.likes_count, (v_rows = 0) as already_liked
    from stickers s
    where s.id = p_sticker_id;
end;
$$;
