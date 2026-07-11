import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { toPublicSticker } from "@/lib/publicSticker";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";
import type { Sticker } from "@/lib/types";

// "Рандомный лист" (changelog "Услышано" п.3) — один случайный не скрытый и
// не истёкший стикер. ?exclude=<id1,id2,...> — весь список уже показанных в
// текущем "круге" (см. RandomStickerModal), чтобы не повторяться, пока круг
// не пройден целиком.
export async function GET(request: Request) {
  const excludeParam = new URL(request.url).searchParams.get("exclude");
  const excludeIds = excludeParam ? excludeParam.split(",").filter(Boolean) : null;

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
    p_exclude_ids: excludeIds,
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
