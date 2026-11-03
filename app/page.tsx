import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/session";
import { WallCanvas } from "@/components/WallCanvas";
import { toPublicSticker } from "@/lib/publicSticker";
import type { Sticker, StickerWithLikedState } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Service role, а не anon: anon больше не может читать session_id/
  // likes_count (миграция 0009), а они нужны здесь, чтобы посчитать is_own и
  // has_reactions. Service role обходит RLS, поэтому фильтр видимости
  // (не скрыт, не истёк) — явно в запросе. В браузер уходит только
  // toPublicSticker(), как и раньше.
  const supabase = createAdminClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const { data: stickers, error } = await supabase
    .from("stickers")
    .select("*")
    .eq("is_hidden", false)
    .gt("expires_at", new Date().toISOString())
    // Самые свежие 500, а не самые старые: при ascending + limit новые
    // стикеры после 500-го просто не попадали на стену после перезагрузки.
    // Порядок отрисовки (старые снизу) восстанавливаем ниже через reverse().
    .order("created_at", { ascending: false })
    .limit(500);
  stickers?.reverse();

  if (error) {
    console.error("Failed to load stickers", error);
  }

  // reactions закрыты RLS для anon (никаких публичных политик на них нет),
  // поэтому какие стикеры лайкнула текущая сессия — читаем через service
  // role. Это Server Component, в браузер он не попадает.
  let likedIds = new Set<string>();
  if (sessionId && stickers && stickers.length > 0) {
    const { data: reactions } = await supabase
      .from("reactions")
      .select("sticker_id")
      .eq("session_id", sessionId)
      .in(
        "sticker_id",
        stickers.map((s) => s.id)
      );
    likedIds = new Set((reactions ?? []).map((r) => r.sticker_id));
  }

  const stickersWithLikedState: StickerWithLikedState[] = (stickers ?? []).map(
    (sticker: Sticker) => ({
      ...toPublicSticker(sticker, sessionId),
      liked_by_me: likedIds.has(sticker.id),
    })
  );

  return <WallCanvas initialStickers={stickersWithLikedState} />;
}
