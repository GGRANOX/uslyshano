import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/ids";

// Защищено HTTP Basic Auth в proxy.ts (matcher покрывает /api/admin/**).
const VALID_ACTIONS = ["approve", "hide", "delete"] as const;
type Action = (typeof VALID_ACTIONS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Стикер не найден." }, { status: 404 });
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  if (typeof body.action !== "string" || !VALID_ACTIONS.includes(body.action as Action)) {
    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
  }
  const action = body.action as Action;

  const supabase = createAdminClient();

  if (action === "delete") {
    const { error } = await supabase.from("stickers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "hide") {
    const { error } = await supabase.from("stickers").update({ is_hidden: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve: жалоба была необоснованной — снимаем жалобы и возвращаем на стену
  const { error: deleteReportsError } = await supabase
    .from("reports")
    .delete()
    .eq("sticker_id", id);
  if (deleteReportsError) {
    return NextResponse.json({ error: deleteReportsError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("stickers")
    .update({ report_count: 0, is_hidden: false })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
