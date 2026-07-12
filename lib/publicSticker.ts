import type { Sticker, PublicSticker } from "./types";

// Единственное место, которое решает, что из строки stickers можно показать
// в браузере. Используется и на сервере (Server Component, API-роуты), и на
// клиенте (WallCanvas разбирает payload'ы Supabase Realtime — там строка
// приходит с "провода" целиком, и её тоже нужно провести через эту функцию
// перед тем, как класть в состояние React).
export function toPublicSticker(row: Sticker, viewerSessionId: string | null): PublicSticker {
  const is_own = viewerSessionId !== null && row.session_id === viewerSessionId;

  return {
    id: row.id,
    text: row.text,
    mood: row.mood,
    position_x: row.position_x,
    position_y: row.position_y,
    rotation: row.rotation,
    decoration_id: row.decoration_id,
    is_sponsored: row.is_sponsored,
    sponsor_url: row.sponsor_url,
    is_hidden: row.is_hidden,
    created_at: row.created_at,
    expires_at: row.expires_at,
    is_own,
    // Число лайков нигде не показывается (см. changelog "Услышано" п.2) —
    // наружу отдаём только булев факт, и только владельцу стикера.
    has_reactions: is_own && row.likes_count > 0,
  };
}
