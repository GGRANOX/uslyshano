"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOODS } from "@/lib/moods";
import type { Mood } from "@/lib/types";

export function SponsoredStickerForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mood, setMood] = useState<Mood>(MOODS[0].key);
  const [sponsorUrl, setSponsorUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !sponsorUrl.trim()) return;
    setStatus("sending");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/sponsored-stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), mood, sponsorUrl: sponsorUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Не удалось создать стикер.");
        return;
      }
      setStatus("done");
      setText("");
      setSponsorUrl("");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Проблема с сетью.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold text-[#2A2A2E]">Добавить спонсорский стикер</h2>
      <p className="mt-1 text-xs text-[#8A8A92]">
        Публикуется сразу с пометкой «Реклама», без модерации и rate limit —
        контент уже проверен вами вручную.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder="Текст спонсорского сообщения"
        className="mt-3 w-full rounded-lg border border-black/10 p-2 text-sm"
      />
      <input
        type="url"
        value={sponsorUrl}
        onChange={(e) => setSponsorUrl(e.target.value)}
        placeholder="Ссылка «Узнать подробнее» — https://..."
        className="mt-2 w-full rounded-lg border border-black/10 p-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={mood}
          onChange={(e) => setMood(e.target.value as Mood)}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm"
        >
          {MOODS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.emoji} {m.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={status === "sending" || !text.trim() || !sponsorUrl.trim()}
          className="rounded-lg bg-[#2A2A2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {status === "sending" ? "..." : "Опубликовать"}
        </button>
      </div>
      {status === "done" && (
        <p className="mt-2 text-xs text-[#1f7a3f]">Стикер опубликован.</p>
      )}
      {status === "error" && <p className="mt-2 text-xs text-[#C1554A]">{message}</p>}
    </form>
  );
}
