-- Фаза 2: жалобы. При 3 жалобах стикер автоматически скрывается до ручной
-- проверки в админ-панели (ТЗ раздел 6, Фаза 2).

create index if not exists reports_sticker_id_idx on reports (sticker_id);

create or replace function report_sticker(p_sticker_id uuid, p_reason text)
returns table (report_count int, is_hidden boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into reports (sticker_id, reason) values (p_sticker_id, p_reason);

  update stickers s
  set report_count = s.report_count + 1,
      is_hidden = (s.report_count + 1 >= 3) or s.is_hidden
  where s.id = p_sticker_id;

  return query
    select s.report_count, s.is_hidden from stickers s where s.id = p_sticker_id;
end;
$$;
