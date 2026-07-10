"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOODS } from "@/lib/moods";
import type { Mood, PublicSticker } from "@/lib/types";
import type { DecorationInfo } from "@/lib/decorations";

const MAX_LENGTH = 1000;

interface ComposerProps {
  onCreated: (sticker: PublicSticker) => void;
}

export function Composer({ onCreated }: ComposerProps) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState<Mood>(MOODS[0].key);
  const [decorationId, setDecorationId] = useState<string>("");
  const [allowFeature, setAllowFeature] = useState(false);
  const [ownedDecorations, setOwnedDecorations] = useState<DecorationInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Декорации доступны в композере, только если сессия уже что-то купила
  // (подтверждено администратором) — см. магазин декораций (кнопка 🎨).
  useEffect(() => {
    fetch("/api/decorations")
      .then((r) => r.json())
      .then((data) => {
        const owned = ((data.decorations ?? []) as DecorationInfo[]).filter((d) => d.owned);
        setOwnedDecorations(owned);
      })
      .catch(() => {});
  }, []);

  // Сообщение "Готово..." само пропадает через несколько секунд.
  useEffect(() => {
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(null), 6000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  const trimmedLength = text.trim().length;
  const canSubmit = trimmedLength > 0 && trimmedLength <= MAX_LENGTH && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          mood,
          decorationId: decorationId || null,
          allowFeature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Не удалось отправить сообщение.");
        return;
      }

      onCreated(data.sticker as PublicSticker);
      setText("");
      setAllowFeature(false);
      setSuccessMessage(
        "Готово. Через неделю это исчезнет — а пока кто-то, возможно, это прочитает."
      );
    } catch {
      setError("Проблема с сетью. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pb-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-3xl bg-white/95 p-4 shadow-xl shadow-black/10 backdrop-blur"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Что у вас на уме?"
          rows={2}
          className="w-full resize-none rounded-xl border border-black/5 bg-[#F1F0F5] p-3 text-sm text-[#2A2A2E] outline-none placeholder:text-[#8A8A92] focus:border-black/10"
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value as Mood)}
              className="rounded-full bg-[#F1F0F5] px-3 py-1.5 text-sm outline-none"
            >
              {MOODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.emoji} {m.label}
                </option>
              ))}
            </select>

            {ownedDecorations.length > 0 && (
              <select
                value={decorationId}
                onChange={(e) => setDecorationId(e.target.value)}
                className="rounded-full bg-[#F1F0F5] px-3 py-1.5 text-sm outline-none"
              >
                <option value="">Без оформления</option>
                {ownedDecorations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            <span
              className={`text-xs ${
                trimmedLength > MAX_LENGTH ? "text-[#C1554A]" : "text-[#8A8A92]"
              }`}
            >
              {trimmedLength}/{MAX_LENGTH}
            </span>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-[#2A2A2E] px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            {submitting ? "Отправка..." : "Повесить"}
          </button>
        </div>

        <label className="mt-2 flex items-center gap-2 text-[11px] text-[#8A8A92]">
          <input
            type="checkbox"
            checked={allowFeature}
            onChange={(e) => setAllowFeature(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-black/20"
          />
          Можно использовать в подборке лучших постов
        </label>

        {error && <p className="mt-2 text-xs text-[#C1554A]">{error}</p>}
        {successMessage && !error && (
          <p className="mt-2 text-xs text-[#1f7a3f]">{successMessage}</p>
        )}

        <p className="mt-2 text-[11px] text-[#8A8A92]">
          Публикуя сообщение, вы подтверждаете, что вам есть 16 лет, и
          соглашаетесь с{" "}
          <Link href="/terms" className="underline hover:text-[#2A2A2E]">
            Условиями использования
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="underline hover:text-[#2A2A2E]">
            Политикой конфиденциальности
          </Link>
          . <Link href="/about" className="underline hover:text-[#2A2A2E]">
            О проекте
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
