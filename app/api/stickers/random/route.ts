import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { toPublicSticker } from "@/lib/publicSticker";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";
import type { Sticker } from "@/lib/types";

// "Рандомный лист" (changelog "Услышано" п.3) — один случайный не скрытый и
// не истёкший стикер. ?exclude=<id> — чтобы "Ещё один" не показывал тот же
// стикер повторно на маленьких наборах данных.
export async function GET(request: Request) {
  const excludeId = new URL(request.url).searchParams.get("exclude");

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

  const { data, error } = await supabase.rpc("get_random_sticker", {
    p_exclude_id: excludeId,
  });

  if (error) {
    console.error("get_random_sticker failed", error);
    return NextResponse.json({ error: "Не удалось найти стикер." }, { status: 500 });
  }

  const row = (data as Sticker[] | null)?.[0];
  if (!row) {
    return NextResponse.json({ sticker: null });
  }

  const { data: reaction } = await supabase
    .from("reactions")
    .select("id")
    .eq("sticker_id", row.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  return NextResponse.json({
    sticker: {
      ...toPublicSticker(row, sessionId),
      liked_by_me: Boolean(reaction),
    },
  });
}
