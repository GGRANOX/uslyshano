import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";

// Один лайк на сессию на стикер (ТЗ раздел 6, Фаза 1). Уникальность
// гарантирует БД (unique (sticker_id, session_id) в таблице reactions),
// инкремент likes_count делает RPC like_sticker атомарно.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stickerId } = await params;

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

  const { data, error } = await supabase
    .rpc("like_sticker", { p_sticker_id: stickerId, p_session_id: sessionId })
    .single();

  if (error) {
    console.error("like_sticker failed", error);
    return NextResponse.json({ error: "Не удалось поставить лайк." }, { status: 500 });
  }

  const result = data as { likes_count: number; already_liked: boolean };

  // likes_count намеренно не уходит в ответ — реакция "Услышал(а)" публично
  // без счётчика (changelog "Услышано" п.2). Автор узнаёт о реакциях через
  // has_reactions на своём же стикере (см. lib/publicSticker.ts), не отсюда.
  return NextResponse.json({
    alreadyLiked: result.already_liked,
  });
}
