-- Ссылка "Узнать подробнее" для спонсорских стикеров (Фаза 3) — админ
-- указывает её при публикации в /admin, на обычных стикерах поле пустое.
alter table stickers add column if not exists sponsor_url text;
