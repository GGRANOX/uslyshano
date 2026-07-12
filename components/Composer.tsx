"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOODS, MOOD_MAP } from "@/lib/moods";
import type { Mood, PublicSticker } from "@/lib/types";
import type { DecorationInfo } from "@/lib/decorations";

const MAX_LENGTH = 1000;

// Нативный <option> не красится инлайн-стилями — цветной кружок-эмодзи как
// приближение реального accent-цвета настроения (lib/moods.ts), чтобы в
// выпадающем списке было видно соответствие цвет -> настроение (см. точку
// на карточке в StickerCard). Точный hex показан отдельно рядом с select'ом.
const MOOD_CIRCLE: Record<Mood, string> = {
  happy: "🟡",
  sad: "🔵",
  angry: "🔴",
  thoughtful: "🟣",
  love: "🩷",
};

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
  // Свёрнутая панель освобождает экран на телефоне — особенно нужно, когда
  // просто листаешь стену, а не пишешь.
  const [collapsed, setCollapsed] = useState(false);

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

  if (collapsed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pb-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-[#2A2A2E] shadow-xl shadow-black/10 backdrop-blur hover:bg-white"
        >
          ✍️ Написать
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pb-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-3xl bg-white/95 p-4 shadow-xl shadow-black/10 backdrop-blur"
      >
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Свернуть панель"
            title="Свернуть"
            className="-mt-1 mb-1 h-5 w-10 rounded-full text-[#8A8A92] hover:text-[#2A2A2E]"
          >
            ︿
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Что у вас на уме?"
          rows={2}
          className="w-full resize-none rounded-xl border border-black/5 bg-[#F1F0F5] p-3 text-sm text-[#2A2A2E] outline-none placeholder:text-[#8A8A92] focus:border-black/10"
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-[#F1F0F5] pl-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: MOOD_MAP[mood].accent }}
                aria-hidden
                title="Цвет этого настроения на карточке"
              />
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                className="rounded-full bg-transparent py-1.5 pr-3 text-sm outline-none"
              >
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {MOOD_CIRCLE[m.key]} {m.emoji} {m.label}
                  </option>
                ))}
              </select>
            </div>

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
