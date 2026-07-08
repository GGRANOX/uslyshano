-- Стена — начальная схема (см. раздел 3 ТЗ)
-- Все таблицы создаются сразу (схема фиксирована в ТЗ), но RLS-политики и
-- функции ниже открывают только то, что нужно для Фазы 1. Таблицы reports/
-- purchases используются с Фазы 2/3 — уже созданы, чтобы не менять схему позже.

create extension if not exists "pgcrypto";

create table if not exists decorations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_kzt int not null,
  style_key text not null, -- 'rainbow-border' | 'gold-frame' | 'soft-glow' | 'starry-border'
  is_active boolean not null default true
);

create table if not exists stickers (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 1000),
  mood text not null check (mood in ('happy','sad','angry','thoughtful','love')),
  position_x float not null,
  position_y float not null,
  rotation float not null default 0,
  decoration_id uuid references decorations(id),
  is_sponsored boolean not null default false,
  session_id text not null,
  likes_count int not null default 0,
  report_count int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists stickers_visible_idx
  on stickers (created_at)
  where is_hidden = false;

create index if not exists stickers_expires_at_idx on stickers (expires_at);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  sticker_id uuid references stickers(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now(),
  unique (sticker_id, session_id) -- один лайк на сессию
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  sticker_id uuid references stickers(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  decoration_id uuid references decorations(id),
  amount_kzt int not null,
  payment_method text not null, -- 'kaspi' | 'manual'
  created_at timestamptz not null default now()
);

-- === Row Level Security ===
-- Всё пишется через серверные API-роуты сервисным ключом (service role),
-- который обходит RLS. Анонимному (публичному) ключу нужен только SELECT
-- на видимые стикеры — этого достаточно и для начальной загрузки, и для
-- Supabase Realtime подписки.

alter table stickers enable row level security;
alter table reactions enable row level security;
alter table reports enable row level security;
alter table decorations enable row level security;
alter table purchases enable row level security;

create policy "public can read visible stickers"
  on stickers for select
  to anon, authenticated
  using (is_hidden = false and expires_at > now());

-- Никаких политик insert/update/delete для anon — по умолчанию запрещено,
-- запись возможна только через service role (серверные API-роуты).

-- === Атомарный лайк ===
-- Вставляет реакцию и инкрементит likes_count одной транзакцией.
-- SECURITY DEFINER, вызывается только из серверного API-роута service role.
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
    update stickers set likes_count = likes_count + 1
    where id = p_sticker_id;
  end if;

  return query
    select s.likes_count, (v_rows = 0) as already_liked
    from stickers s
    where s.id = p_sticker_id;
end;
$$;

-- Начальные декорации для магазина (Фаза 3), уже описаны в ТЗ разделе 6.
insert into decorations (name, price_kzt, style_key, is_active) values
  ('Радужная рамка', 500, 'rainbow-border', true),
  ('Золотая рамка', 1500, 'gold-frame', true),
  ('Мягкое свечение', 700, 'soft-glow', true),
  ('Звёздная рамка', 1000, 'starry-border', true)
on conflict do nothing;
