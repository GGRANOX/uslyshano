import { cookies } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/session";
import { WallCanvas } from "@/components/WallCanvas";
import { toPublicSticker } from "@/lib/publicSticker";
import type { Sticker, StickerWithLikedState } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createPublicClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const { data: stickers, error } = await supabase
    .from("stickers")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Failed to load stickers", error);
  }

  // reactions закрыты RLS для anon (никаких публичных политик на них нет),
  // поэтому какие стикеры лайкнула текущая сессия — читаем через service
  // role. Это Server Component, в браузер он не попадает.
  let likedIds = new Set<string>();
  if (sessionId && stickers && stickers.length > 0) {
    const admin = createAdminClient();
    const { data: reactions } = await admin
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
