import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateText } from "@/lib/moderation";
import { checkBannedWords } from "@/lib/wordFilter";
import { isRateLimited, POSTS_PER_HOUR_LIMIT } from "@/lib/rateLimit";
import { pickStickerPosition } from "@/lib/layout";
import { MOOD_MAP } from "@/lib/moods";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";
import { toPublicSticker } from "@/lib/publicSticker";
import type { Mood } from "@/lib/types";

const MAX_LENGTH = 1000;

export async function POST(request: Request) {
  let body: {
    text?: unknown;
    mood?: unknown;
    decorationId?: unknown;
    allowFeature?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mood = typeof body.mood === "string" ? (body.mood as Mood) : null;
  const decorationId = typeof body.decorationId === "string" ? body.decorationId : null;
  const allowFeature = body.allowFeature === true;

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

  if (await isRateLimited(supabase, sessionId)) {
    return NextResponse.json(
      {
        error: `Слишком много сообщений подряд — не больше ${POSTS_PER_HOUR_LIMIT} в час. Попробуйте позже.`,
      },
      { status: 429 }
    );
  }

  if (decorationId) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("session_id", sessionId)
      .eq("decoration_id", decorationId)
      .limit(1)
      .maybeSingle();

    if (!purchase) {
      return NextResponse.json(
        { error: "Эта декорация не куплена для вашей сессии." },
        { status: 403 }
      );
    }
  }

  const wordFilterResult = checkBannedWords(text);
  if (wordFilterResult.flagged) {
    return NextResponse.json({ error: wordFilterResult.reason }, { status: 422 });
  }

  let moderation;
  try {
    moderation = await moderateText(text);
  } catch (error) {
    console.error("Moderation error", error);
    // В production модерация обязательна — публикацию блокируем. В
    // локальной разработке (нет/кончился баланс OpenAI и т.п.) даём
    // публиковать без неё, полагаясь на словарь запрещённых слов выше —
    // иначе тестировать сайт без настроенного биллинга невозможно.
    // ВАЖНО: перед реальным запуском (Vercel) убедитесь, что
    // OPENAI_API_KEY рабочий — там это исключение не сработает.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Не удалось проверить сообщение модерацией. Попробуйте ещё раз." },
        { status: 502 }
      );
    }
    moderation = { flagged: false };
  }

  if (moderation.flagged) {
    return NextResponse.json({ error: moderation.reason }, { status: 422 });
  }

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
      decoration_id: decorationId,
      allow_feature: allowFeature,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to insert sticker", insertError);
    return NextResponse.json({ error: "Не удалось создать стикер." }, { status: 500 });
  }

  // Строка из insert().select() — полная (с session_id), в браузер уходит
  // только санитизированная версия (см. lib/publicSticker.ts).
  return NextResponse.json(
    { sticker: toPublicSticker(sticker, sessionId) },
    { status: 201 }
  );
}
