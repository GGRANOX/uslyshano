-- "Рандомный лист" (changelog "Услышано" п.3) — один случайный не скрытый и
-- не истёкший стикер. Простая случайная выборка, без сложной оптимизации —
-- на масштабе MVP `order by random()` по такой маленькой таблице достаточно.
--
-- p_exclude_id позволяет кнопке "Ещё один" не показывать тот же стикер
-- повторно на маленьких наборах данных.
create or replace function get_random_sticker(p_exclude_id uuid default null)
returns setof stickers
language sql
stable
as $$
  select *
  from stickers
  where is_hidden = false
    and expires_at > now()
    and (p_exclude_id is null or id <> p_exclude_id)
  order by random()
  limit 1;
$$;
