import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/session";

// Автор может удалить только свой стикер (session_id должен совпасть) — в
// отличие от /api/admin/stickers/[id], который защищён Basic Auth и может
// удалить любой.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stickerId } = await params;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Сессия не найдена." }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: sticker } = await supabase
    .from("stickers")
    .select("session_id")
    .eq("id", stickerId)
    .maybeSingle();

  if (!sticker) {
    return NextResponse.json({ error: "Стикер не найден." }, { status: 404 });
  }
  if (sticker.session_id !== sessionId) {
    return NextResponse.json(
      { error: "Можно удалить только свой стикер." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("stickers").delete().eq("id", stickerId);
  if (error) {
    console.error("Failed to delete own sticker", error);
    return NextResponse.json({ error: "Не удалось удалить стикер." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
