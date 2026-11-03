import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidReportReason } from "@/lib/reportReasons";
import { SESSION_COOKIE } from "@/lib/session";
import { isUuid } from "@/lib/ids";
import { hitIpLimit } from "@/lib/ipRateLimit";
import { verifyTurnstile } from "@/lib/turnstile";

// Не больше стольких жалоб с одной сессии в час — защита от "зачистки" стены
// скриптом. Обычному человеку столько не нужно.
const REPORTS_PER_HOUR_LIMIT = 10;

// Кнопка "Пожаловаться" с причиной; при 3 жалобах от РАЗНЫХ сессий стикер
// автоматически скрывается до ручной проверки (ТЗ раздел 6, Фаза 2).
// Повторная жалоба той же сессии на тот же стикер не учитывается
// (уникальный индекс в reports, миграция 0009).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stickerId } = await params;
  if (!isUuid(stickerId)) {
    return NextResponse.json({ error: "Стикер не найден." }, { status: 404 });
  }

  let body: { reason?: unknown; turnstileToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  if (!isValidReportReason(body.reason)) {
    return NextResponse.json({ error: "Укажите причину жалобы." }, { status: 400 });
  }

  // Cookie ставит proxy.ts на первый же визит страницы. Если её нет —
  // запрос пришёл не из браузера с открытой стеной; новую сессию тут не
  // выдаём, иначе каждый запрос без cookie считался бы новым жалобщиком.
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json(
      { error: "Обновите страницу и попробуйте ещё раз." },
      { status: 401 }
    );
  }

  const turnstile = await verifyTurnstile(body.turnstileToken, request);
  if (turnstile === "failed") {
    return NextResponse.json(
      { error: "Не удалось подтвердить, что вы не робот. Попробуйте ещё раз." },
      { status: 403 }
    );
  }
  if (turnstile === "error") {
    return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 503 });
  }

  const supabase = createAdminClient();

  // Жаловаться можно только на то, что реально висит на стене. Раньше
  // несуществующий id ронял RPC (нарушение внешнего ключа) с 500.
  const { data: sticker, error: stickerError } = await supabase
    .from("stickers")
    .select("id")
    .eq("id", stickerId)
    .eq("is_hidden", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (stickerError) {
    console.error("Report: sticker lookup failed", stickerError);
    return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 503 });
  }
  if (!sticker) {
    return NextResponse.json({ error: "Стикер не найден." }, { status: 404 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gt("created_at", oneHourAgo);

  if (countError) {
    console.error("Report rate limit check failed", countError);
    return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 503 });
  }
  if ((count ?? 0) >= REPORTS_PER_HOUR_LIMIT) {
    return NextResponse.json(
      { error: "Слишком много жалоб подряд. Попробуйте позже." },
      { status: 429 }
    );
  }

  const ipLimit = await hitIpLimit(supabase, request, "report");
  if (ipLimit === "error") {
    return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 503 });
  }
  if (ipLimit === "limited") {
    return NextResponse.json(
      { error: "Слишком много жалоб из вашей сети. Попробуйте позже." },
      { status: 429 }
    );
  }

  const { data, error } = await supabase
    .rpc("report_sticker", {
      p_sticker_id: stickerId,
      p_session_id: sessionId,
      p_reason: body.reason,
    })
    .single();

  if (error) {
    console.error("report_sticker failed", error);
    return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 500 });
  }

  const result = data as { report_count: number; is_hidden: boolean; already_reported: boolean };

  // report_count наружу не отдаём: он приватный (миграция 0009), а по нему
  // можно было бы понять, сколько ещё жалоб нужно, чтобы скрыть стикер.
  return NextResponse.json({
    alreadyReported: result.already_reported,
    isHidden: result.is_hidden,
  });
}
