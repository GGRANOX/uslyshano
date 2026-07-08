"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPORT_REASONS } from "@/lib/reportReasons";
import { MOOD_MAP } from "@/lib/moods";
import type { Sticker } from "@/lib/types";

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.key, r.label])
);

interface ModerationQueueItemProps {
  sticker: Sticker;
  reports: { reason: string; created_at: string }[];
}

export function ModerationQueueItem({ sticker, reports }: ModerationQueueItemProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function act(action: "approve" | "hide" | "delete") {
    setPending(action);
    try {
      await fetch(`/api/admin/stickers/${sticker.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-[#8A8A92]">
        <span aria-hidden>{MOOD_MAP[sticker.mood].emoji}</span>
        <span>{sticker.is_hidden ? "скрыт" : "видим"}</span>
        <span>·</span>
        <span>жалоб: {sticker.report_count}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#2A2A2E]">
        {sticker.text}
      </p>

      {reports.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {reports.map((r, i) => (
            <li
              key={i}
              className="rounded-full bg-[#F1F0F5] px-2 py-0.5 text-[11px] text-[#6B6B72]"
            >
              {REASON_LABELS[r.reason] ?? r.reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={pending !== null}
          className="rounded-full bg-[#E3A93B]/20 px-3 py-1 text-xs font-semibold text-[#8A6D1F] disabled:opacity-50"
        >
          Одобрить (снять жалобы)
        </button>
        {!sticker.is_hidden && (
          <button
            type="button"
            onClick={() => act("hide")}
            disabled={pending !== null}
            className="rounded-full bg-[#8A79B8]/20 px-3 py-1 text-xs font-semibold text-[#5B4C8A] disabled:opacity-50"
          >
            Скрыть
          </button>
        )}
        <button
          type="button"
          onClick={() => act("delete")}
          disabled={pending !== null}
          className="rounded-full bg-[#C1554A]/20 px-3 py-1 text-xs font-semibold text-[#C1554A] disabled:opacity-50"
        >
          Удалить навсегда
        </button>
      </div>
    </div>
  );
}
