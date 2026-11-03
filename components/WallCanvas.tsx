"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CARD_WIDTH, CARD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/layout";
import { Header } from "./Header";
import { Composer } from "./Composer";
import { StickerCard } from "./StickerCard";
import { DecorationShopModal } from "./DecorationShopModal";
import { SupportModal } from "./SupportModal";
import { RandomStickerModal } from "./RandomStickerModal";
import { OnboardingModal } from "./OnboardingModal";
import { toPublicSticker } from "@/lib/publicSticker";
import type { PublicSticker, Sticker, StickerWithLikedState } from "@/lib/types";
import type { ReportReasonKey } from "@/lib/reportReasons";
import type { DecorationStyleKey } from "@/lib/decorations";
import {
  WALL_BG_DARK,
  WALL_BG_LIGHT,
  WALL_TEXT_MUTED_DARK,
  WALL_TEXT_MUTED_LIGHT,
} from "@/lib/moods";

const VIRTUALIZATION_BUFFER = 500; // px за пределами видимой области
const WALL_THEME_STORAGE_KEY = "uslyshano-wall-theme";
type WallTheme = "dark" | "light";

// Спонсорские стикеры — не больше 1 на каждые ~15 обычных в видимой области
// (ТЗ раздел 6, Фаза 3). Ограничение применяется здесь, при рендере, а не при
// создании — так плотность остаётся верной, даже если несколько спонсорских
// стикеров случайно оказались в одной области холста.
const SPONSORED_RATIO = 15;

// Холст фиксированного размера (lib/layout.ts) — таскаем его через pan
// вместо обычного скролла, чтобы можно было двигаться и по вертикали, и по
// горизонтали, но не бесконечно ("стенки" — границы CANVAS_WIDTH/HEIGHT).
const DRAG_THRESHOLD = 6; // px — меньше считаем кликом, не перетаскиванием
const PAN_TRANSITION_MS = 500;

// Зум колёсиком мыши — холст с карточками масштабируется как единое целое
// (CSS transform: scale на том же слое, что и pan), в тех же границах-"стенках".
const MIN_SCALE = 0.4;
const MAX_SCALE = 2;
const WHEEL_ZOOM_INTENSITY = 0.0015;

interface Pan {
  x: number;
  y: number;
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function clampPan(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number
): Pan {
  const minX = Math.min(0, viewportWidth - CANVAS_WIDTH * scale);
  const minY = Math.min(0, viewportHeight - CANVAS_HEIGHT * scale);
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  };
}

interface WallCanvasProps {
  initialStickers: StickerWithLikedState[];
}

export function WallCanvas({ initialStickers }: WallCanvasProps) {
  const [stickers, setStickers] = useState<Map<string, StickerWithLikedState>>(
    () => new Map(initialStickers.map((s) => [s.id, s]))
  );
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [panTransition, setPanTransition] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [decorationStyles, setDecorationStyles] = useState<Map<string, DecorationStyleKey>>(
    new Map()
  );
  const [shopOpen, setShopOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [wallTheme, setWallTheme] = useState<WallTheme>("dark");
  // На узких экранах (< 640px) абсолютные x/y холста не помещаются по
  // ширине и требуют горизонтального скролла — вместо этого показываем
  // обычный список в один столбец (без pan/zoom, он там и не нужен).
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(
    null
  );
  const centeredRef = useRef(false);

  // Тема холста запоминается на устройстве (не влияет на цвет самих
  // карточек — только на фон, см. uslyshano-design.md). Промис оборачивает
  // чтение localStorage — setState вызывается из callback'а, а не синхронно
  // в теле эффекта (react-hooks/set-state-in-effect), как в OnboardingModal.
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem(WALL_THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") setWallTheme(stored);
      } catch {
        // localStorage недоступен — остаёмся на теме по умолчанию
      }
    });
  }, []);

  // Промис для первого чтения (react-hooks/set-state-in-effect); сам
  // listener — нормальная подписка на внешнее событие (изменение ширины).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileLayout(mq.matches);
    Promise.resolve().then(update);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function toggleWallTheme() {
    setWallTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(WALL_THEME_STORAGE_KEY, next);
      } catch {
        // ничего страшного — просто не запомнится на этом устройстве
      }
      return next;
    });
  }
  // Realtime-подписка ниже монтируется один раз ([]) — читает актуальный
  // sessionId через ref, а не через замыкание над устаревшим state.
  const mySessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    mySessionIdRef.current = mySessionId;
  }, [mySessionId]);

  // Карта decoration_id -> style_key для отрисовки купленных оформлений на
  // чужих стикерах, приходящих через Realtime (там нет джойна с decorations).
  // Заодно узнаём свой собственный session_id — он нужен ТОЛЬКО для того,
  // чтобы на клиенте отличить "это мой стикер" у данных, прилетающих через
  // Realtime (см. обработчики ниже) — сырой session_id чужих стикеров при
  // этом никогда не сохраняется в состоянии React (toPublicSticker его
  // отбрасывает сразу после сравнения).
  useEffect(() => {
    fetch("/api/decorations")
      .then((r) => r.json())
      .then((data) => {
        const entries = (data.decorations ?? []) as { id: string; styleKey: DecorationStyleKey }[];
        setDecorationStyles(new Map(entries.map((d) => [d.id, d.styleKey])));
        setMySessionId(data.sessionId ?? null);
      })
      .catch(() => {});
  }, []);

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
          // payload.new содержит только публичные колонки: session_id/
          // likes_count закрыты для anon на уровне БД (миграция 0009), так что
          // is_own здесь всегда false. Свой стикер приходит раньше или позже
          // через handleCreated (ответ POST /api/stickers) и перезаписывает
          // эту версию правильной, с is_own = true.
          const incoming = toPublicSticker(payload.new as Sticker, mySessionIdRef.current);
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
          const incoming = toPublicSticker(payload.new as Sticker, mySessionIdRef.current);
          setStickers((prev) => {
            const existing = prev.get(incoming.id);
            const next = new Map(prev);
            next.set(incoming.id, {
              ...incoming,
              // Владение и факт реакций Realtime не передаёт (приватные
              // колонки, см. выше) — берём то, что уже знали с сервера.
              is_own: existing?.is_own ?? false,
              has_reactions: existing?.has_reactions ?? false,
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
    setViewportSize({ width: el.clientWidth, height: el.clientHeight });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Если ширина экрана пересекла границу мобильной раскладки и мы
  // вернулись на холст — контейнер с ref смонтировался заново, нужно
  // перемерить (иначе pan/scale остались бы привязаны к старым 0x0).
  useEffect(() => {
    if (!isMobileLayout) Promise.resolve().then(measure);
  }, [isMobileLayout, measure]);

  // Стартовая позиция — центр холста, чтобы при первом визите было видно
  // стикеры со всех сторон, а не только пустой левый верхний угол. setState
  // из callback'а Promise, а не синхронно в теле эффекта (см. тему выше).
  useEffect(() => {
    if (centeredRef.current) return;
    if (viewportSize.width === 0 && viewportSize.height === 0) return;
    centeredRef.current = true;
    Promise.resolve().then(() => {
      setPan(
        clampPan(
          viewportSize.width / 2 - CANVAS_WIDTH / 2,
          viewportSize.height / 2 - CANVAS_HEIGHT / 2,
          viewportSize.width,
          viewportSize.height,
          1
        )
      );
    });
  }, [viewportSize]);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return; // только левая кнопка мыши
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y, moved: false };
    setPanTransition(false);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setIsDragging(true);
    }
    setPan(
      clampPan(drag.originX + dx, drag.originY + dy, viewportSize.width, viewportSize.height, scale)
    );
  }

  // Зум колёсиком, с "фокусом" на курсоре — та же точка холста остаётся под
  // курсором до и после. transform-origin у слоя холста стоит в 0 0 (см.
  // JSX ниже), поэтому pan — это смещение в экранных px независимо от scale,
  // а перевод экранных координат в координаты холста учитывает текущий scale.
  function handleWheel(e: React.WheelEvent) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const newScale = clampScale(scale * (1 - e.deltaY * WHEEL_ZOOM_INTENSITY));
    const canvasX = (cursorX - pan.x) / scale;
    const canvasY = (cursorY - pan.y) / scale;

    setScale(newScale);
    setPanTransition(false);
    setPan(
      clampPan(
        cursorX - canvasX * newScale,
        cursorY - canvasY * newScale,
        viewportSize.width,
        viewportSize.height,
        newScale
      )
    );
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (drag?.moved) {
      // После настоящего перетаскивания браузер всё равно шлёт click по
      // элементу под пальцем/курсором — гасим один такой "призрачный" клик,
      // чтобы драг не срабатывал как нажатие на кнопку под ним.
      const suppressClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      document.addEventListener("click", suppressClick, { capture: true, once: true });
    }
  }

  const allStickers = useMemo(() => Array.from(stickers.values()), [stickers]);

  const visibleStickers = useMemo(() => {
    const inViewport =
      viewportSize.width === 0 || viewportSize.height === 0
        ? allStickers // до первого измерения — рендерим всё
        : allStickers.filter((s) => {
            // Границы видимой области в координатах холста (не экрана) —
            // экран -> холст: (screen - pan) / scale, плюс запас-буфер тоже
            // переводим в масштаб холста.
            const buffer = VIRTUALIZATION_BUFFER / scale;
            const left = -pan.x / scale - buffer;
            const right = (-pan.x + viewportSize.width) / scale + buffer;
            const top = -pan.y / scale - buffer;
            const bottom = (-pan.y + viewportSize.height) / scale + buffer;
            return (
              s.position_x + CARD_WIDTH >= left &&
              s.position_x <= right &&
              s.position_y + CARD_HEIGHT >= top &&
              s.position_y <= bottom
            );
          });

    const regular = inViewport.filter((s) => !s.is_sponsored);
    const sponsored = inViewport.filter((s) => s.is_sponsored);
    const sponsoredLimit = Math.max(1, Math.floor(regular.length / SPONSORED_RATIO));

    if (sponsored.length <= sponsoredLimit) {
      return inViewport;
    }
    return [...regular, ...sponsored.slice(0, sponsoredLimit)];
  }, [allStickers, pan, scale, viewportSize]);

  async function handleLike(id: string) {
    if (pendingLikes.has(id)) return;

    setPendingLikes((prev) => new Set(prev).add(id));
    // Оптимистичное обновление — сразу подсвечиваем реакцию. Число лайков
    // нигде не показывается (changelog "Услышано" п.2), поэтому обновлять
    // тут нечего, кроме liked_by_me и — на всякий случай самореакции на
    // собственный стикер — has_reactions.
    setStickers((prev) => {
      const existing = prev.get(id);
      if (!existing || existing.liked_by_me) return prev;
      const next = new Map(prev);
      next.set(id, {
        ...existing,
        liked_by_me: true,
        has_reactions: existing.is_own ? true : existing.has_reactions,
      });
      return next;
    });

    try {
      const response = await fetch(`/api/stickers/${id}/like`, { method: "POST" });
      if (!response.ok) {
        // не удалось — откатываем оптимистичное обновление
        setStickers((prev) => {
          const existing = prev.get(id);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(id, { ...existing, liked_by_me: false });
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

  async function handleDelete(id: string) {
    const response = await fetch(`/api/stickers/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error("delete failed");
    }
    setStickers((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function handleCreated(sticker: PublicSticker) {
    setStickers((prev) => {
      const next = new Map(prev);
      next.set(sticker.id, { ...sticker, liked_by_me: false });
      return next;
    });
    setPanTransition(true);
    setPan(
      clampPan(
        viewportSize.width / 2 - (sticker.position_x + CARD_WIDTH / 2) * scale,
        viewportSize.height / 2 - (sticker.position_y + CARD_HEIGHT / 2) * scale,
        viewportSize.width,
        viewportSize.height,
        scale
      )
    );
    setTimeout(() => setPanTransition(false), PAN_TRANSITION_MS);
  }

  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{ backgroundColor: wallTheme === "dark" ? WALL_BG_DARK : WALL_BG_LIGHT }}
    >
      <Header
        count={allStickers.length}
        onOpenShop={() => setShopOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
        onOpenRandom={() => setRandomOpen(true)}
        wallTheme={wallTheme}
        onToggleWallTheme={toggleWallTheme}
      />

      {isMobileLayout ? (
        <div className="flex-1 overflow-y-auto px-4 pt-24 pb-40">
          <div className="mx-auto flex max-w-sm flex-col gap-5">
            {allStickers.map((sticker) => (
              <StickerCard
                key={sticker.id}
                sticker={sticker}
                variant="list"
                onLike={handleLike}
                likePending={pendingLikes.has(sticker.id)}
                onReport={handleReport}
                onDelete={handleDelete}
                decorationStyleKey={
                  sticker.decoration_id ? decorationStyles.get(sticker.decoration_id) ?? null : null
                }
              />
            ))}
            {allStickers.length === 0 && (
              <p
                className="mt-16 text-center text-sm"
                style={{ color: wallTheme === "dark" ? WALL_TEXT_MUTED_DARK : WALL_TEXT_MUTED_LIGHT }}
              >
                Пока пусто — повесьте первый стикер
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`relative flex-1 overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transformOrigin: "0 0",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: panTransition ? `transform ${PAN_TRANSITION_MS}ms ease` : undefined,
            }}
          >
            {visibleStickers.map((sticker) => (
              <StickerCard
                key={sticker.id}
                sticker={sticker}
                onLike={handleLike}
                likePending={pendingLikes.has(sticker.id)}
                onReport={handleReport}
                onDelete={handleDelete}
                decorationStyleKey={
                  sticker.decoration_id ? decorationStyles.get(sticker.decoration_id) ?? null : null
                }
              />
            ))}
          </div>
          {allStickers.length === 0 && (
            <p
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-xs -translate-x-1/2 -translate-y-1/2 text-center text-sm"
              style={{ color: wallTheme === "dark" ? WALL_TEXT_MUTED_DARK : WALL_TEXT_MUTED_LIGHT }}
            >
              Пока пусто — повесьте первый стикер
            </p>
          )}
        </div>
      )}

      <Composer onCreated={handleCreated} />

      <DecorationShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <RandomStickerModal open={randomOpen} onClose={() => setRandomOpen(false)} />
      <OnboardingModal />
    </div>
  );
}
