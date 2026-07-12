import { createAdminClient } from "@/lib/supabase/admin";
import { ModerationQueueItem } from "@/components/admin/ModerationQueueItem";
import { PurchaseConfirmForm } from "@/components/admin/PurchaseConfirmForm";
import { SponsoredStickerForm } from "@/components/admin/SponsoredStickerForm";
import { SponsoredStickerItem } from "@/components/admin/SponsoredStickerItem";
import { SPONSORED_SESSION_ID } from "@/lib/session";
import type { Sticker } from "@/lib/types";

export const dynamic = "force-dynamic";

// Доступ защищён HTTP Basic Auth в proxy.ts — сюда не попадёт никто без
// пароля ADMIN_PASSWORD (ТЗ раздел 6, Фаза 2: "простая админ-панель...
// для просмотра и удаления жалоб/нарушений").
//
// Модерация и монетизация — независимые секции: сбой загрузки очереди жалоб
// не должен блокировать формы подтверждения покупок/спонсорских стикеров,
// поэтому ошибка обрабатывается локально, без раннего return для всей страницы.
export default async function AdminPage() {
  const supabase = createAdminClient();

  const { data: stickers, error } = await supabase
    .from("stickers")
    .select("*")
    .or("is_hidden.eq.true,report_count.gt.0")
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const stickerList: Sticker[] = stickers ?? [];
  const stickerIds = stickerList.map((s) => s.id);

  const { data: sponsoredStickers } = await supabase
    .from("stickers")
    .select("*")
    .eq("is_sponsored", true)
    .order("created_at", { ascending: false });

  // Активность по сессиям — узнать нельзя, кто конкретно за куки стоит
  // (session_id анонимный, никаких личных данных нет), но можно посчитать
  // сколько всего разных "куки" вообще что-то делали, и сколько постов/
  // реакций на каждую приходится. Считаем в JS, а не SQL group by — на
  // масштабе MVP таблицы маленькие, а так не нужна отдельная миграция/RPC.
  const { data: allStickerSessions } = await supabase
    .from("stickers")
    .select("session_id")
    .neq("session_id", SPONSORED_SESSION_ID);
  const { data: allReactionSessions } = await supabase
    .from("reactions")
    .select("session_id");

  const postCounts = new Map<string, number>();
  for (const row of allStickerSessions ?? []) {
    postCounts.set(row.session_id, (postCounts.get(row.session_id) ?? 0) + 1);
  }
  const reactionCounts = new Map<string, number>();
  for (const row of allReactionSessions ?? []) {
    reactionCounts.set(row.session_id, (reactionCounts.get(row.session_id) ?? 0) + 1);
  }

  const allSessionIds = new Set([...postCounts.keys(), ...reactionCounts.keys()]);
  const sessionActivity = Array.from(allSessionIds)
    .map((sessionId) => ({
      sessionId,
      posts: postCounts.get(sessionId) ?? 0,
      reactions: reactionCounts.get(sessionId) ?? 0,
    }))
    .sort((a, b) => b.posts + b.reactions - (a.posts + a.reactions));

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
        {error && (
          <p className="text-sm text-[#C1554A]">
            Ошибка загрузки очереди модерации: {error.message}
          </p>
        )}
        {!error && stickerList.length === 0 && (
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

      <h1 className="mt-10 text-2xl font-extrabold text-[#2A2A2E]">Монетизация</h1>
      <div className="mt-4 flex flex-col gap-4">
        <PurchaseConfirmForm />
        <SponsoredStickerForm />
      </div>

      <h1 className="mt-10 text-2xl font-extrabold text-[#2A2A2E]">Рекламные стикеры</h1>
      <div className="mt-4 flex flex-col gap-4">
        {(!sponsoredStickers || sponsoredStickers.length === 0) && (
          <p className="text-sm text-[#8A8A92]">Пока ни одного не опубликовано.</p>
        )}
        {(sponsoredStickers ?? []).map((sticker) => (
          <SponsoredStickerItem key={sticker.id} sticker={sticker} />
        ))}
      </div>

      <h1 className="mt-10 text-2xl font-extrabold text-[#2A2A2E]">Активность по сессиям</h1>
      <p className="mt-1 text-sm text-[#6B6B72]">
        Кто именно стоит за анонимной сессией — узнать нельзя, только
        сколько их вообще и насколько активна каждая. {sessionActivity.length}{" "}
        {sessionActivity.length === 1 ? "уникальная сессия" : "уникальных сессий"} хоть
        что-то сделали (пост или реакция).
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-black/10 bg-white">
        {sessionActivity.length === 0 ? (
          <p className="p-4 text-sm text-[#8A8A92]">Пока никакой активности нет.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-[#8A8A92]">
                <th className="px-4 py-2 font-semibold">Сессия (код для покупок)</th>
                <th className="px-4 py-2 font-semibold">Постов</th>
                <th className="px-4 py-2 font-semibold">Услышано нажато</th>
              </tr>
            </thead>
            <tbody>
              {sessionActivity.map((row) => (
                <tr key={row.sessionId} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-[#2A2A2E]">{row.sessionId}</td>
                  <td className="px-4 py-2 text-[#2A2A2E]">{row.posts}</td>
                  <td className="px-4 py-2 text-[#2A2A2E]">{row.reactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
