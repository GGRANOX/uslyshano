"use client";

import { useEffect, useState } from "react";
import { MOOD_MAP } from "@/lib/moods";
import type { StickerWithLikedState } from "@/lib/types";
import { CARD_WIDTH } from "@/lib/layout";
import { REPORT_REASONS, type ReportReasonKey } from "@/lib/reportReasons";
import { getDecorationVisual, type DecorationStyleKey } from "@/lib/decorations";

const DAY_MS = 1000 * 60 * 60 * 24;
const FADE_WINDOW_MS = DAY_MS; // последние 24 часа жизни — постепенное выцветание

interface StickerCardProps {
  sticker: StickerWithLikedState;
  onLike: (id: string) => void;
  likePending: boolean;
  onReport: (id: string, reason: ReportReasonKey) => Promise<void>;
  decorationStyleKey: DecorationStyleKey | null;
  /** 'wall' (по умолчанию) — абсолютное позиционирование на холсте.
   * 'standalone' — обычный блок по центру родителя (см. RandomStickerModal). */
  variant?: "wall" | "standalone";
  /** Переопределяет поведение кнопки "Поделиться" (используется для
   * генерации картинки в "Рандомном листе" вместо копирования ссылки). */
  onShareOverride?: () => void;
}

export function StickerCard({
  sticker,
  onLike,
  likePending,
  onReport,
  decorationStyleKey,
  variant = "wall",
  onShareOverride,
}: StickerCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const [reportState, setReportState] = useState<"idle" | "picking" | "sending" | "sent">(
    "idle"
  );
  const [reportReason, setReportReason] = useState<ReportReasonKey>(REPORT_REASONS[0].key);

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
    if (onShareOverride) {
      onShareOverride();
      return;
    }
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

  async function handleReportSubmit() {
    setReportState("sending");
    try {
      await onReport(sticker.id, reportReason);
      setReportState("sent");
    } catch {
      setReportState("picking");
    }
  }

  const decorationVisual = getDecorationVisual(decorationStyleKey);
  const isWall = variant === "wall";

  return (
    <div
      id={`sticker-${sticker.id}`}
      className={`rounded-2xl p-4 shadow-md shadow-black/5 transition-opacity duration-700 ${
        isWall ? "absolute" : "relative mx-auto w-full max-w-sm"
      } ${isFading ? "sticker-corner-fold" : ""} ${
        sticker.is_sponsored ? "ring-2 ring-[#E3A93B]" : ""
      }`}
      style={{
        left: isWall ? `${sticker.position_x}%` : undefined,
        top: isWall ? sticker.position_y : undefined,
        width: isWall ? CARD_WIDTH : undefined,
        backgroundColor: sticker.is_sponsored ? "#FDFCFA" : mood.cardBg,
        transform: `rotate(${sticker.rotation}deg)`,
        opacity,
        ...decorationVisual.style,
      }}
    >
      {decorationVisual.cornerStars && (
        <>
          <span className="absolute -top-2 -left-2 text-sm" aria-hidden>
            ✨
          </span>
          <span className="absolute -bottom-2 -right-2 text-sm" aria-hidden>
            ✨
          </span>
        </>
      )}

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

      {sticker.is_own && sticker.has_reactions && (
        <p className="mt-2 text-[11px] font-medium text-[#C96E8D]">
          🫂 тебя услышали
        </p>
      )}

      <div className="mt-3 flex items-center gap-4 text-sm text-[#6B6B72]">
        <button
          type="button"
          onClick={() => onLike(sticker.id)}
          disabled={likePending || sticker.liked_by_me}
          className={`flex items-center gap-1 transition-colors disabled:cursor-default ${
            sticker.liked_by_me ? "text-[#C96E8D]" : "hover:text-[#C96E8D]"
          }`}
          aria-pressed={sticker.liked_by_me}
        >
          <span aria-hidden>🫂</span>
          <span>Услышал(а)</span>
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

        <button
          type="button"
          onClick={() => setReportState(reportState === "idle" ? "picking" : "idle")}
          disabled={reportState === "sent"}
          className="ml-auto flex items-center gap-1 hover:text-[#C1554A] disabled:cursor-default disabled:opacity-40"
          aria-label="Пожаловаться"
          title="Пожаловаться"
        >
          <span aria-hidden>🚩</span>
        </button>
      </div>

      {reportState === "sent" && (
        <p className="mt-2 text-[11px] text-[#8A8A92]">Жалоба отправлена</p>
      )}

      {(reportState === "picking" || reportState === "sending") && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-black/5 p-2">
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value as ReportReasonKey)}
            disabled={reportState === "sending"}
            className="flex-1 rounded-lg border-none bg-white/80 px-2 py-1 text-[11px] outline-none"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleReportSubmit}
            disabled={reportState === "sending"}
            className="rounded-lg bg-[#C1554A] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {reportState === "sending" ? "..." : "Отправить"}
          </button>
        </div>
      )}
    </div>
  );
}
