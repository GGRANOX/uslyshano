import { createAdminClient } from "@/lib/supabase/admin";
import { ModerationQueueItem } from "@/components/admin/ModerationQueueItem";
import type { Sticker } from "@/lib/types";

export const dynamic = "force-dynamic";

// Доступ защищён HTTP Basic Auth в proxy.ts — сюда не попадёт никто без
// пароля ADMIN_PASSWORD (ТЗ раздел 6, Фаза 2: "простая админ-панель...
// для просмотра и удаления жалоб/нарушений").
export default async function AdminPage() {
  const supabase = createAdminClient();

  const { data: stickers, error } = await supabase
    .from("stickers")
    .select("*")
    .or("is_hidden.eq.true,report_count.gt.0")
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-[#C1554A]">
        Ошибка загрузки очереди модерации: {error.message}
      </div>
    );
  }

  const stickerList: Sticker[] = stickers ?? [];
  const stickerIds = stickerList.map((s) => s.id);

  const reportsBySticker = new Map<string, { reason: string; created_at: string }[]>();
  if (stickerIds.length > 0) {
    const { data: reports } = await supabase
      .from("reports")
      .select("sticker_id, reason, created_at")
      .in("sticker_id", stickerIds)
      .order("created_at", { ascending: false });

    for (const r of reports ?? []) {
      const list = reportsBySticker.get(r.sticker_id) ?? [];
      list.push({ reason: r.reason, created_at: r.created_at });
      reportsBySticker.set(r.sticker_id, list);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-extrabold text-[#2A2A2E]">Модерация</h1>
      <p className="mt-1 text-sm text-[#6B6B72]">
        Стикеры с жалобами и/или скрытые автоматически (3+ жалобы).
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {stickerList.length === 0 && (
          <p className="text-sm text-[#8A8A92]">Очередь пуста — жалоб нет.</p>
        )}
        {stickerList.map((sticker) => (
          <ModerationQueueItem
            key={sticker.id}
            sticker={sticker}
            reports={reportsBySticker.get(sticker.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
