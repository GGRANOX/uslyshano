-- Фаза 3: магазин декораций (ТЗ раздел 6). decorations нужно читать публично
-- (анонимным ключом) — и для витрины магазина, и чтобы отрисовать декорацию
-- на уже купленных стикерах других сессий. Ничего чувствительного в таблице
-- нет (название, цена, ключ стиля), покупки (purchases) остаются закрыты —
-- их обрабатывает только админ через service role.

create policy "public can read active decorations"
  on decorations for select
  to anon, authenticated
  using (is_active = true);
