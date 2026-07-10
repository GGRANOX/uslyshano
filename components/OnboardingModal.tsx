"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "uslyshano_onboarding_seen";

// Экран при первом визите (changelog "Услышано" п.4). Показывается один раз
// на браузер — дальше не мешает, подзаголовок под шапкой (Header.tsx)
// покрывает тот же смысл для тех, кто уже возвращался.
export function OnboardingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Промис оборачивает чтение localStorage — setState вызывается из
    // callback'а, а не синхронно в теле эффекта (react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          setOpen(true);
        }
      } catch {
        // localStorage недоступен (приватный режим и т.п.) — просто не показываем
      }
    });
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ничего страшного — покажется ещё раз в следующий визит
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center">
        <p className="text-2xl font-extrabold text-[#2A2A2E]">Анонимно. Услышано.</p>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6B72]">
          Пиши то, что чувствуешь — с пометкой настроения. Читай, что чувствуют
          другие — свои посты или случайные. Нажми «услышан(а)», если тронуло.
          Через неделю всё исчезнет — успей.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-full bg-[#2A2A2E] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Понятно, начнём
        </button>
      </div>
    </div>
  );
}
