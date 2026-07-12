"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOOD_MAP } from "@/lib/moods";
import type { Sticker } from "@/lib/types";

interface SponsoredStickerItemProps {
  sticker: Sticker;
}

// Удаление переиспользует общий /api/admin/stickers/[id] с action="delete" —
// тот же эндпоинт, что и у очереди модерации (components/admin/ModerationQueueItem.tsx).
export function SponsoredStickerItem({ sticker }: SponsoredStickerItemProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm("Удалить этот рекламный стикер безвозвратно?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/stickers/${sticker.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-[#8A8A92]">
        <span aria-hidden>{MOOD_MAP[sticker.mood].emoji}</span>
        <span>{sticker.is_hidden ? "скрыт" : "видим"}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#2A2A2E]">
        {sticker.text}
      </p>

      <p className="mt-2 break-all text-xs text-[#6B6B72]">
        {sticker.sponsor_url ?? "ссылка не указана"}
      </p>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="mt-3 rounded-full bg-[#C1554A]/20 px-3 py-1 text-xs font-semibold text-[#C1554A] disabled:opacity-50"
      >
        {deleting ? "Удаление..." : "Удалить"}
      </button>
    </div>
  );
}
