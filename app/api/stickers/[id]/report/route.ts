import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidReportReason } from "@/lib/reportReasons";

// Кнопка "Пожаловаться" с причиной; при 3 жалобах стикер автоматически
// скрывается до ручной проверки (ТЗ раздел 6, Фаза 2).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stickerId } = await params;

  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  if (!isValidReportReason(body.reason)) {
    return NextResponse.json({ error: "Укажите причину жалобы." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("report_sticker", { p_sticker_id: stickerId, p_reason: body.reason })
    .single();

  if (error) {
    console.error("report_sticker failed", error);
    return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 500 });
  }

  const result = data as { report_count: number; is_hidden: boolean };

  return NextResponse.json({
    reportCount: result.report_count,
    isHidden: result.is_hidden,
  });
}
