"use client";

import { useState } from "react";

interface HeaderProps {
  count: number;
  onOpenShop: () => void;
  onOpenSupport: () => void;
  onOpenRandom: () => void;
  wallTheme: "dark" | "light";
  onToggleWallTheme: () => void;
}

export function Header({
  count,
  onOpenShop,
  onOpenSupport,
  onOpenRandom,
  wallTheme,
  onToggleWallTheme,
}: HeaderProps) {
  // Кнопки действий свёрнуты в "⋯" по умолчанию — на маленьких экранах
  // весь ряд из 5 пилюль не помещается / выглядит громоздко. Разворачиваются
  // по нажатию, сворачиваются обратно после выбора действия.
  const [menuOpen, setMenuOpen] = useState(false);

  function handleAction(action: () => void) {
    action();
    setMenuOpen(false);
  }

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-30 flex w-full max-w-[92vw] -translate-x-1/2 flex-col items-center gap-2">
      {/* flex-wrap — при разворачивании "⋯" ряд кнопок не должен становиться
          шире экрана: это раньше выталкивало "Услышано" за левый край
          (весь блок центрируется по СВОЕЙ ширине через left-1/2+translate,
          поэтому переполнение обрезало текст с обеих сторон). */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="pointer-events-auto flex shrink-0 items-center gap-3 rounded-full bg-white/90 px-5 py-2.5 shadow-lg shadow-black/5 backdrop-blur">
          <span className="shrink-0 text-lg font-extrabold tracking-tight text-[#2A2A2E]">
            Услышано
          </span>
          <span className="shrink-0 rounded-full bg-[#F1F0F5] px-3 py-1 text-xs font-semibold text-[#6B6B72]">
            сообщения {count}
          </span>
        </div>

        {menuOpen && (
          <>
            <button
              type="button"
              onClick={() => handleAction(onOpenRandom)}
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
              title="Случайный момент"
            >
              🎲
            </button>

            <button
              type="button"
              onClick={() => handleAction(onOpenShop)}
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
              title="Магазин декораций"
            >
              🎨
            </button>

            <button
              type="button"
              onClick={() => handleAction(onOpenSupport)}
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
              title="Поддержать проект"
            >
              💛
            </button>

            <button
              type="button"
              onClick={onToggleWallTheme}
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
              title={wallTheme === "dark" ? "Светлый холст" : "Тёмный холст"}
            >
              {wallTheme === "dark" ? "☀️" : "🌙"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
          aria-label={menuOpen ? "Скрыть меню" : "Ещё"}
          aria-expanded={menuOpen}
          title={menuOpen ? "Скрыть" : "Ещё"}
        >
          {menuOpen ? "✕" : "⋯"}
        </button>
      </div>

      <p className="hidden max-w-md px-4 text-center text-xs text-[#8A8A92] sm:block">
        Пиши то, что чувствуешь — с пометкой настроения. Читай, что чувствуют
        другие — свои посты или случайные. Нажми «услышан(а)», если тронуло.
        Через неделю всё исчезнет — успей.
      </p>
    </div>
  );
}
