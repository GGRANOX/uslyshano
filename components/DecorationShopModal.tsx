"use client";

import { useEffect, useState } from "react";
import { getDecorationVisual, type DecorationInfo } from "@/lib/decorations";
import { MOOD_MAP } from "@/lib/moods";
import { KaspiPaymentBlock } from "./KaspiPaymentBlock";

interface DecorationShopModalProps {
  open: boolean;
  onClose: () => void;
}

const PREVIEW_MOOD = MOOD_MAP.happy;

export function DecorationShopModal({ open, onClose }: DecorationShopModalProps) {
  const [decorations, setDecorations] = useState<DecorationInfo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/decorations")
      .then((r) => r.json())
      .then((data) => {
        setDecorations(data.decorations ?? []);
        setSessionId(data.sessionId ?? null);
      });
  }, [open]);

  const loading = open && sessionId === null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#2A2A2E]">Магазин декораций</h2>
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
          Оформление для ваших стикеров. Оплата — переводом в Kaspi,
          активация вручную администратором.
        </p>

        {loading && <p className="mt-4 text-sm text-[#8A8A92]">Загрузка...</p>}

        <div className="mt-4 flex flex-col gap-3">
          {decorations.map((d) => {
            const visual = getDecorationVisual(d.styleKey);
            const isExpanded = expandedId === d.id;

            return (
              <div key={d.id} className="rounded-2xl border border-black/10 p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-16 w-16 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: PREVIEW_MOOD.cardBg, ...visual.style }}
                  >
                    {PREVIEW_MOOD.emoji}
                    {visual.cornerStars && (
                      <>
                        <span className="absolute -top-1.5 -left-1.5 text-xs" aria-hidden>
                          ✨
                        </span>
                        <span className="absolute -bottom-1.5 -right-1.5 text-xs" aria-hidden>
                          ✨
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#2A2A2E]">{d.name}</p>
                    <p className="text-xs text-[#8A8A92]">{d.priceKzt} ₸</p>
                  </div>

                  {d.owned ? (
                    <span className="rounded-full bg-[#47cf73]/20 px-3 py-1 text-xs font-semibold text-[#1f7a3f]">
                      Куплено ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      className="rounded-full bg-[#2A2A2E] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Купить
                    </button>
                  )}
                </div>

                {isExpanded && !d.owned && (
                  <div className="mt-3">
                    <KaspiPaymentBlock
                      amountLabel={`${d.priceKzt} ₸`}
                      purposeCode={sessionId ?? undefined}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
