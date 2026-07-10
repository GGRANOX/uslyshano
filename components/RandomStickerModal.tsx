"use client";

import { useEffect, useState } from "react";
import { StickerCard } from "./StickerCard";
import type { StickerWithLikedState } from "@/lib/types";
import type { ReportReasonKey } from "@/lib/reportReasons";
import type { DecorationStyleKey } from "@/lib/decorations";

interface RandomStickerModalProps {
  open: boolean;
  onClose: () => void;
}

// "Рандомный лист" (changelog "Услышано" п.3) — основной канал для тех, кто
// ничего не пишет сам, а заходит посмотреть чей-то момент без обязательств.
export function RandomStickerModal({ open, onClose }: RandomStickerModalProps) {
  const [sticker, setSticker] = useState<StickerWithLikedState | null>(null);
  const [decorationStyles, setDecorationStyles] = useState<Map<string, DecorationStyleKey>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/decorations")
      .then((r) => r.json())
      .then((data) => {
        const entries = (data.decorations ?? []) as { id: string; styleKey: DecorationStyleKey }[];
        setDecorationStyles(new Map(entries.map((d) => [d.id, d.styleKey])));
      })
      .catch(() => {});
    loadNext(null);
  }, [open]);

  async function loadNext(excludeId: string | null) {
    setLoading(true);
    setEmpty(false);
    try {
      const url = excludeId
        ? `/api/stickers/random?exclude=${excludeId}`
        : "/api/stickers/random";
      const response = await fetch(url);
      const data = await response.json();
      if (data.sticker) {
        setSticker(data.sticker);
      } else {
        setSticker(null);
        setEmpty(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLike(id: string) {
    if (likePending || !sticker || sticker.liked_by_me) return;
    setLikePending(true);
    setSticker({
      ...sticker,
      liked_by_me: true,
      has_reactions: sticker.is_own ? true : sticker.has_reactions,
    });
    try {
      const response = await fetch(`/api/stickers/${id}/like`, { method: "POST" });
      if (!response.ok) {
        setSticker((prev) => (prev ? { ...prev, liked_by_me: false } : prev));
      }
    } finally {
      setLikePending(false);
    }
  }

  async function handleReport(id: string, reason: ReportReasonKey) {
    const response = await fetch(`/api/stickers/${id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      throw new Error("report failed");
    }
    const data = await response.json();
    if (data.isHidden) {
      setSticker(null);
      setEmpty(true);
    }
  }

  async function handleShareImage() {
    if (!sticker || sharing) return;
    setSharing(true);
    try {
      const response = await fetch(`/api/stickers/${sticker.id}/share-image`);
      const blob = await response.blob();
      const file = new File([blob], "uslyshano.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      // Fallback: открываем картинку в новой вкладке — можно сохранить/переслать вручную
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      // пользователь отменил шеринг — тихо игнорируем
    } finally {
      setSharing(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#2A2A2E]">Случайный момент</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full px-2 py-1 text-[#8A8A92] hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          {loading && <p className="text-sm text-[#8A8A92]">Ищем момент...</p>}

          {!loading && empty && (
            <p className="text-sm text-[#8A8A92]">
              Пока нечего показать — стена ещё пуста.
            </p>
          )}

          {!loading && sticker && (
            <StickerCard
              sticker={sticker}
              onLike={handleLike}
              likePending={likePending}
              onReport={handleReport}
              decorationStyleKey={
                sticker.decoration_id
                  ? decorationStyles.get(sticker.decoration_id) ?? null
                  : null
              }
              variant="standalone"
              onShareOverride={handleShareImage}
            />
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => loadNext(sticker?.id ?? null)}
            disabled={loading}
            className="flex-1 rounded-full bg-[#2A2A2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Ещё один
          </button>
        </div>

        {sharing && (
          <p className="mt-2 text-center text-xs text-[#8A8A92]">Готовим картинку...</p>
        )}
      </div>
    </div>
  );
}
