import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, generateSessionId } from "@/lib/session";
import { isDecorationStyleKey } from "@/lib/decorations";

// Магазин декораций (ТЗ раздел 6, Фаза 3). Отдаёт список активных декораций
// и то, какие из них уже куплены текущей анонимной сессией.
//
// sessionId возвращается в ответе намеренно: cookie httpOnly, клиентский JS
// не может прочитать её напрямую, а магазину и композеру нужно показать
// пользователю "его код" для указания в комментарии к Kaspi-переводу.
export async function GET() {
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

  const { data: decorations, error } = await supabase
    .from("decorations")
    .select("id, name, price_kzt, style_key")
    .eq("is_active", true)
    .order("price_kzt", { ascending: true });

  if (error) {
    console.error("Failed to load decorations", error);
    return NextResponse.json({ error: "Не удалось загрузить магазин." }, { status: 500 });
  }

  const { data: purchases } = await supabase
    .from("purchases")
    .select("decoration_id")
    .eq("session_id", sessionId);

  const ownedIds = new Set((purchases ?? []).map((p) => p.decoration_id));

  const result = (decorations ?? [])
    .filter((d) => isDecorationStyleKey(d.style_key))
    .map((d) => ({
      id: d.id,
      name: d.name,
      priceKzt: d.price_kzt,
      styleKey: d.style_key,
      owned: ownedIds.has(d.id),
    }));

  return NextResponse.json({ sessionId, decorations: result });
}
