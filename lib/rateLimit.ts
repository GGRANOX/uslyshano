import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Rate limiting: не больше ~5-10 постов на сессию в час (ТЗ раздел 6, Фаза 2).
// Простая реализация на БД (без Redis) — достаточно для MVP-нагрузки.
export const POSTS_PER_HOUR_LIMIT = 8;

export async function isRateLimited(
  supabase: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("stickers")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gt("created_at", oneHourAgo);

  if (error) {
    // Fail closed: если проверить лимит не удалось, публикацию не пропускаем —
    // иначе любой сбой БД (или его провокация) отключал бы защиту от спама.
    // Вызывающий роут превращает это в 503.
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  return (count ?? 0) >= POSTS_PER_HOUR_LIMIT;
}
