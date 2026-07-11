-- "Рандомный лист" без повторов в рамках одного круга: раньше исключался
-- только один (предыдущий) стикер, теперь — весь список уже показанных в
-- этом круге. Сигнатура функции меняется (uuid -> uuid[]), поэтому старую
-- версию сначала дропаем — create or replace не подменяет функцию при
-- другом наборе параметров, а создаёт вторую перегрузку.
drop function if exists get_random_sticker(uuid);

create or replace function get_random_sticker(p_exclude_ids uuid[] default null)
returns setof stickers
language sql
stable
as $$
  select *
  from stickers
  where is_hidden = false
    and expires_at > now()
    and (p_exclude_ids is null or id <> all(p_exclude_ids))
  order by random()
  limit 1;
$$;
