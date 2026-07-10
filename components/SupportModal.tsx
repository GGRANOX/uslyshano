"use client";

import { KaspiPaymentBlock } from "./KaspiPaymentBlock";

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

// Статическая ссылка/QR на перевод в Kaspi (ТЗ раздел 6, Фаза 3, "Поддержка")
// — минимум усилий, низкий приоритет. Без привязки к сессии/декорациям.
export function SupportModal({ open, onClose }: SupportModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#2A2A2E]">Поддержать проект</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full px-2 py-1 text-[#8A8A92] hover:bg-black/5"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-[#6B6B72]">
          «Услышано» бесплатно и без рекламы для читателей. Если хотите помочь с
          расходами на хостинг — любая сумма приветствуется.
        </p>

        <div className="mt-4">
          <KaspiPaymentBlock />
        </div>
      </div>
    </div>
  );
}
