import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Защищено HTTP Basic Auth в proxy.ts. Ручное подтверждение оплаты Kaspi
// (ТЗ раздел 6, Фаза 3: "админ вручную подтверждает и включает декорацию
// сессии" — без полноценной платёжной интеграции).
export async function POST(request: Request) {
  let body: { sessionId?: unknown; decorationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const decorationId = typeof body.decorationId === "string" ? body.decorationId : "";

  if (!sessionId || !decorationId) {
    return NextResponse.json(
      { error: "Укажите код сессии и декорацию." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: decoration, error: decorationError } = await supabase
    .from("decorations")
    .select("id, price_kzt")
    .eq("id", decorationId)
    .single();

  if (decorationError || !decoration) {
    return NextResponse.json({ error: "Декорация не найдена." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("purchases").insert({
    session_id: sessionId,
    decoration_id: decoration.id,
    amount_kzt: decoration.price_kzt,
    payment_method: "manual",
  });

  if (insertError) {
    console.error("Failed to record purchase", insertError);
    return NextResponse.json({ error: "Не удалось подтвердить покупку." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
