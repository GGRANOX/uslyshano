"use client";

import { useEffect, useRef, useState } from "react";
import { StickerCard } from "./StickerCard";
import type { StickerWithLikedState } from "@/lib/types";
import type { ReportReasonKey } from "@/lib/reportReasons";
import type { DecorationStyleKey } from "@/lib/decorations";

interface RandomStickerModalProps {
  open: boolean;
  onClose: () => void;
}

interface Nav {
  history: StickerWithLikedState[];
  index: number; // -1 = ничего ещё не загружено
}

async function fetchRandom(excludeIds: string[]): Promise<StickerWithLikedState | null> {
  const url =
    excludeIds.length > 0
      ? `/api/stickers/random?exclude=${excludeIds.join(",")}`
      : "/api/stickers/random";
  const response = await fetch(url);
  const data = await response.json();
  return data.sticker ?? null;
}

// "Рандомный лист" (changelog "Услышано" п.3) — основной канал для тех, кто
// ничего не пишет сам, а заходит посмотреть чей-то момент без обязательств.
//
// "Круг" без повторов: seenInCycleRef копит id всех показанных с открытия
// модалки стикеров и передаётся как exclude — так один и тот же стикер не
// вылезет снова, пока не закончатся все остальные. Когда сервер больше
// ничего не находит — круг пройден целиком, начинаем заново (сбрасываем
// список и просим ещё раз, теперь уже без исключений).
// nav.history хранит уже увиденные в этой сессии стикеры целиком (не
// только id), чтобы кнопка "назад" листала их без лишних походов на сервер.
export function RandomStickerModal({ open, onClose }: RandomStickerModalProps) {
  const [nav, setNav] = useState<Nav>({ history: [], index: -1 });
  const [decorationStyles, setDecorationStyles] = useState<Map<string, DecorationStyleKey>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [sharing, setSharing] = useState(false);
  const seenInCycleRef = useRef<Set<string>>(new Set());

  const sticker = nav.index >= 0 ? nav.history[nav.index] : null;

  async function loadFirst() {
    // Сброс делаем здесь (не прямо в теле useEffect) — react-hooks/set-state-in-effect
    // запрещает синхронный setState в самом эффекте, а вызов из обычной
    // (пусть и async) функции — это ОК.
    seenInCycleRef.current = new Set();
    setNav({ history: [], index: -1 });
    setLoading(true);
    setEmpty(false);
    try {
      const result = await fetchRandom([]);
      if (result) {
        seenInCycleRef.current = new Set([result.id]);
        setNav({ history: [result], index: 0 });
      } else {
        setEmpty(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetch("/api/decorations")
      .then((r) => r.json())
      .then((data) => {
        const entries = (data.decorations ?? []) as { id: string; styleKey: DecorationStyleKey }[];
        setDecorationStyles(new Map(entries.map((d) => [d.id, d.styleKey])));
      })
      .catch(() => {});

    // Promise оборачивает вызов — setState внутри loadFirst срабатывает из
    // callback'а, а не синхронно в теле эффекта (react-hooks/set-state-in-effect).
    Promise.resolve().then(() => loadFirst());
  }, [open]);

  async function loadNext() {
    if (nav.index < nav.history.length - 1) {
      // уже листали назад — впереди есть закэшированный, лишний запрос не нужен
      setNav((prev) => ({ ...prev, index: prev.index + 1 }));
      return;
    }
    setLoading(true);
    try {
      let result = await fetchRandom(Array.from(seenInCycleRef.current));
      if (!result && seenInCycleRef.current.size > 0) {
        // круг пройден целиком — начинаем новый
        seenInCycleRef.current = new Set();
        result = await fetchRandom([]);
      }
      if (result) {
        seenInCycleRef.current.add(result.id);
        setNav((prev) => ({ history: [...prev.history, result!], index: prev.history.length }));
      } else {
        setEmpty(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setNav((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  }

  async function handleLike(id: string) {
    if (likePending || !sticker || sticker.liked_by_me) return;
    setLikePending(true);
    setNav((prev) => ({
      ...prev,
      history: prev.history.map((s) =>
        s.id === id
          ? { ...s, liked_by_me: true, has_reactions: s.is_own ? true : s.has_reactions }
          : s
      ),
    }));
    try {
      const response = await fetch(`/api/stickers/${id}/like`, { method: "POST" });
      if (!response.ok) {
        setNav((prev) => ({
          ...prev,
          history: prev.history.map((s) => (s.id === id ? { ...s, liked_by_me: false } : s)),
        }));
      }
    } finally {
      setLikePending(false);
    }
  }

  // Убирает текущий стикер (удалён автором или скрыт жалобой) и сразу
  // показывает следующий — из кэша, если он уже есть, иначе с сервера.
  async function removeCurrentAndAdvance() {
    const removedId = sticker?.id;
    if (!removedId) return;
    seenInCycleRef.current.delete(removedId);

    let needsFetch = false;
    setNav((prev) => {
      const idx = prev.history.findIndex((s) => s.id === removedId);
      if (idx === -1) return prev;
      const history = [...prev.history.slice(0, idx), ...prev.history.slice(idx + 1)];
      if (idx < history.length) {
        return { history, index: idx };
      }
      needsFetch = true;
      return { history, index: history.length - 1 };
    });

    if (needsFetch) {
      await loadNext();
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
      await removeCurrentAndAdvance();
    }
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/stickers/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error("delete failed");
    }
    await removeCurrentAndAdvance();
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
              onDelete={handleDelete}
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
            onClick={goBack}
            disabled={loading || nav.index <= 0}
            aria-label="Назад"
            title="Предыдущий момент"
            className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-[#2A2A2E] disabled:cursor-default disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={loadNext}
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
