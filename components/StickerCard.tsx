"use client";

import { useEffect, useState } from "react";
import { MOOD_MAP } from "@/lib/moods";
import type { StickerWithLikedState } from "@/lib/types";
import { CARD_WIDTH } from "@/lib/layout";

const DAY_MS = 1000 * 60 * 60 * 24;
const FADE_WINDOW_MS = DAY_MS; // последние 24 часа жизни — постепенное выцветание

interface StickerCardProps {
  sticker: StickerWithLikedState;
  onLike: (id: string) => void;
  likePending: boolean;
}

export function StickerCard({ sticker, onLike, likePending }: StickerCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const mood = MOOD_MAP[sticker.mood];
  const expiresAt = new Date(sticker.expires_at).getTime();
  const remainingMs = Math.max(0, expiresAt - now);
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_MS));

  const isFading = remainingMs <= FADE_WINDOW_MS;
  const opacity = isFading ? Math.max(0.35, remainingMs / FADE_WINDOW_MS) : 1;

  const timestampLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(sticker.created_at));

  async function handleShare() {
    const url = `${window.location.origin}/#sticker-${sticker.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, text: sticker.text });
        return;
      } catch {
        // пользователь отменил — тихо игнорируем
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <div
      id={`sticker-${sticker.id}`}
      className={`absolute rounded-2xl p-4 shadow-md shadow-black/5 transition-opacity duration-700 ${
        isFading ? "sticker-corner-fold" : ""
      } ${sticker.is_sponsored ? "ring-2 ring-[#E3A93B]" : ""}`}
      style={{
        left: `${sticker.position_x}%`,
        top: sticker.position_y,
        width: CARD_WIDTH,
        backgroundColor: sticker.is_sponsored ? "#FDFCFA" : mood.cardBg,
        transform: `rotate(${sticker.rotation}deg)`,
        opacity,
      }}
    >
      {sticker.is_sponsored && (
        <span className="mb-1 inline-block rounded-full bg-[#2A2A2E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Реклама
        </span>
      )}

      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none" aria-hidden>
          {mood.emoji}
        </span>
        <span className="text-xs text-[#6B6B72]">{timestampLabel}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-snug text-[#2A2A2E]">
        {sticker.text}
      </p>

      <span
        className="mt-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: mood.accent + "22", color: mood.accent }}
      >
        {daysRemaining > 0
          ? `исчезнет через ${daysRemaining} дн.`
          : "исчезает сегодня"}
      </span>

      <div className="mt-3 flex items-center gap-4 text-sm text-[#6B6B72]">
        <button
          type="button"
          onClick={() => onLike(sticker.id)}
          disabled={likePending || sticker.liked_by_me}
          className={`flex items-center gap-1 transition-colors disabled:cursor-default ${
            sticker.liked_by_me ? "text-[#C1554A]" : "hover:text-[#C1554A]"
          }`}
          aria-pressed={sticker.liked_by_me}
        >
          <span aria-hidden>{sticker.liked_by_me ? "❤" : "🤍"}</span>
          <span>{sticker.likes_count}</span>
        </button>

        <span className="flex items-center gap-1 opacity-50" title="Комментарии скоро">
          <span aria-hidden>💬</span>
        </span>

        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1 hover:text-[#2A2A2E]"
          aria-label="Поделиться"
        >
          <span aria-hidden>↗</span>
        </button>
      </div>
    </div>
  );
}
