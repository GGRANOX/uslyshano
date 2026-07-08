import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateText } from "@/lib/moderation";
import { pickStickerPosition } from "@/lib/layout";
import { MOOD_MAP } from "@/lib/moods";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";
import type { Mood } from "@/lib/types";

const MAX_LENGTH = 1000;

export async function POST(request: Request) {
  let body: { text?: unknown; mood?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mood = typeof body.mood === "string" ? (body.mood as Mood) : null;

  if (!text || text.length === 0) {
    return NextResponse.json({ error: "Сообщение не может быть пустым." }, { status: 400 });
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Сообщение длиннее ${MAX_LENGTH} символов.` },
      { status: 400 }
    );
  }
  if (!mood || !MOOD_MAP[mood]) {
    return NextResponse.json({ error: "Выберите настроение." }, { status: 400 });
  }

  let moderation;
  try {
    moderation = await moderateText(text);
  } catch (error) {
    console.error("Moderation error", error);
    return NextResponse.json(
      { error: "Не удалось проверить сообщение модерацией. Попробуйте ещё раз." },
      { status: 502 }
    );
  }

  if (moderation.flagged) {
    return NextResponse.json({ error: moderation.reason }, { status: 422 });
  }

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    sessionId = generateSessionId();
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("stickers")
    .select("position_x, position_y")
    .eq("is_hidden", false)
    .gt("expires_at", new Date().toISOString())
    .limit(500);

  if (fetchError) {
    console.error("Failed to fetch existing stickers", fetchError);
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
      session_id: sessionId,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to insert sticker", insertError);
    return NextResponse.json({ error: "Не удалось создать стикер." }, { status: 500 });
  }

  return NextResponse.json({ sticker }, { status: 201 });
}
