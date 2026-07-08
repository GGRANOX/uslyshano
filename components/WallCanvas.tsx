"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeCanvasHeight, CARD_HEIGHT } from "@/lib/layout";
import { Header } from "./Header";
import { Composer } from "./Composer";
import { StickerCard } from "./StickerCard";
import type { Sticker, StickerWithLikedState } from "@/lib/types";
import type { ReportReasonKey } from "@/lib/reportReasons";

const VIRTUALIZATION_BUFFER = 500; // px над/под видимой областью

interface WallCanvasProps {
  initialStickers: StickerWithLikedState[];
}

export function WallCanvas({ initialStickers }: WallCanvasProps) {
  const [stickers, setStickers] = useState<Map<string, StickerWithLikedState>>(
    () => new Map(initialStickers.map((s) => [s.id, s]))
  );
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Realtime: подписка на изменения таблицы stickers (ТЗ раздел 6, Фаза 1 —
  // "появляется на холсте почти в реальном времени"). RLS ограничивает поток
  // только видимыми (не скрытыми, не истёкшими) стикерами.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("stickers-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stickers" },
        (payload) => {
          const incoming = payload.new as Sticker;
          setStickers((prev) => {
            if (prev.has(incoming.id)) return prev;
            const next = new Map(prev);
            next.set(incoming.id, { ...incoming, liked_by_me: false });
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stickers" },
        (payload) => {
          const incoming = payload.new as Sticker;
          setStickers((prev) => {
            const existing = prev.get(incoming.id);
            const next = new Map(prev);
            next.set(incoming.id, {
              ...incoming,
              liked_by_me: existing?.liked_by_me ?? false,
            });
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "stickers" },
        (payload) => {
          const removedId = (payload.old as { id: string }).id;
          setStickers((prev) => {
            if (!prev.has(removedId)) return prev;
            const next = new Map(prev);
            next.delete(removedId);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    setViewportHeight(el.clientHeight);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const allStickers = useMemo(() => Array.from(stickers.values()), [stickers]);
  const canvasHeight = useMemo(() => computeCanvasHeight(allStickers), [allStickers]);

  const visibleStickers = useMemo(() => {
    if (viewportHeight === 0) return allStickers; // до первого измерения — рендерим всё
    const top = scrollTop - VIRTUALIZATION_BUFFER;
    const bottom = scrollTop + viewportHeight + VIRTUALIZATION_BUFFER;
    return allStickers.filter(
      (s) => s.position_y + CARD_HEIGHT >= top && s.position_y <= bottom
    );
  }, [allStickers, scrollTop, viewportHeight]);

  async function handleLike(id: string) {
    if (pendingLikes.has(id)) return;

    setPendingLikes((prev) => new Set(prev).add(id));
    // Оптимистичное обновление — сразу подсвечиваем лайк
    setStickers((prev) => {
      const existing = prev.get(id);
      if (!existing || existing.liked_by_me) return prev;
      const next = new Map(prev);
      next.set(id, { ...existing, liked_by_me: true, likes_count: existing.likes_count + 1 });
      return next;
    });

    try {
      const response = await fetch(`/api/stickers/${id}/like`, { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setStickers((prev) => {
          const existing = prev.get(id);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(id, { ...existing, likes_count: data.likesCount, liked_by_me: true });
          return next;
        });
      }
    } finally {
      setPendingLikes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
    // Если жалоба репортящего стала третьей — сразу убираем стикер из его
    // собственной ленты. У остальных уже открытых вкладок карточка исчезнет
    // при следующей загрузке страницы (RLS перестаёт отдавать скрытые записи).
    if (data.isHidden) {
      setStickers((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function handleCreated(sticker: Sticker) {
    setStickers((prev) => {
      const next = new Map(prev);
      next.set(sticker.id, { ...sticker, liked_by_me: false });
      return next;
    });
    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: sticker.position_y - 80, behavior: "smooth" });
    });
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <Header count={allStickers.length} />

      <div
        ref={containerRef}
        onScroll={measure}
        className="flex-1 overflow-y-auto pt-24 pb-40"
      >
        <div className="relative mx-auto max-w-[1200px]" style={{ height: canvasHeight }}>
          {visibleStickers.map((sticker) => (
            <StickerCard
              key={sticker.id}
              sticker={sticker}
              onLike={handleLike}
              likePending={pendingLikes.has(sticker.id)}
              onReport={handleReport}
            />
          ))}
          {allStickers.length === 0 && (
            <p className="absolute left-1/2 top-16 -translate-x-1/2 text-center text-sm text-[#8A8A92]">
              Стена пока пуста — повесьте первый стикер
            </p>
          )}
        </div>
      </div>

      <Composer onCreated={handleCreated} />
    </div>
  );
}
