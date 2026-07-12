import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickStickerPosition } from "@/lib/layout";
import { MOOD_MAP } from "@/lib/moods";
import type { Mood } from "@/lib/types";

const MAX_LENGTH = 1000;
// Спонсорские стикеры вставляются вручную админом, без своего session-токена
// (ТЗ раздел 6, Фаза 3: "первые 3-5 партнёров", самообслуживания не строим).
const SPONSORED_SESSION_ID = "admin-sponsored";

// Защищено HTTP Basic Auth в proxy.ts. Без модерации/rate limit — контент
// уже проверен человеком (администратором) перед публикацией.
export async function POST(request: Request) {
  let body: { text?: unknown; mood?: unknown; sponsorUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mood = typeof body.mood === "string" ? (body.mood as Mood) : null;
  const sponsorUrl = typeof body.sponsorUrl === "string" ? body.sponsorUrl.trim() : "";

  if (!text || text.length === 0 || text.length > MAX_LENGTH) {
    return NextResponse.json({ error: "Некорректный текст." }, { status: 400 });
  }
  if (!mood || !MOOD_MAP[mood]) {
    return NextResponse.json({ error: "Выберите настроение." }, { status: 400 });
  }
  if (!/^https?:\/\/.+/.test(sponsorUrl)) {
    return NextResponse.json(
      { error: "Укажите ссылку «Узнать подробнее» (начинается с http:// или https://)." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("stickers")
    .select("position_x, position_y")
    .eq("is_hidden", false)
    .gt("expires_at", new Date().toISOString())
    .limit(500);

  if (fetchError) {
    return NextResponse.json({ error: "Не удалось создать стикер." }, { status: 500 });
  }

  const position = pickStickerPosition(existing ?? []);

  const { data: sticker, error: insertError } = await supabase
    .from("stickers")
    .insert({
      text,
      mood,
      position_x: position.position_x,
      position_y: position.position_y,
      rotation: position.rotation,
      session_id: SPONSORED_SESSION_ID,
      is_sponsored: true,
      sponsor_url: sponsorUrl,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to insert sponsored sticker", insertError);
    return NextResponse.json({ error: "Не удалось создать стикер." }, { status: 500 });
  }

  return NextResponse.json({ sticker });
}
