import type { CSSProperties } from "react";

// Ключи должны совпадать с check-constraint style_key в таблице decorations
// (ТЗ раздел 3): 'rainbow-border' | 'gold-frame' | 'soft-glow' | 'starry-border'.
export type DecorationStyleKey =
  | "rainbow-border"
  | "gold-frame"
  | "soft-glow"
  | "starry-border";

const KNOWN_STYLE_KEYS: DecorationStyleKey[] = [
  "rainbow-border",
  "gold-frame",
  "soft-glow",
  "starry-border",
];

export function isDecorationStyleKey(value: string): value is DecorationStyleKey {
  return (KNOWN_STYLE_KEYS as string[]).includes(value);
}

export interface DecorationInfo {
  id: string;
  name: string;
  priceKzt: number;
  styleKey: DecorationStyleKey;
  owned: boolean;
}

export interface DecorationVisual {
  style: CSSProperties;
  cornerStars?: boolean;
}

const NO_DECORATION: DecorationVisual = { style: {} };

// Визуальные стили декораций — обычный CSS через inline-style (border-image
// для градиентных рамок, box-shadow для свечения), накладывается прямо на
// стиль карточки без дополнительных обёрток. Оформление ориентировочное —
// поменять дизайн позже можно, тронув только этот файл.
export function getDecorationVisual(
  styleKey: DecorationStyleKey | null | undefined
): DecorationVisual {
  switch (styleKey) {
    case "rainbow-border":
      return {
        style: {
          border: "3px solid transparent",
          borderImage:
            "conic-gradient(from 0deg, #ff5f6d, #ffc371, #47cf73, #3aa0ff, #a06bff, #ff5f6d) 1",
        },
      };
    case "gold-frame":
      return {
        style: {
          border: "3px solid transparent",
          borderImage: "linear-gradient(135deg, #FFD700, #B8860B, #FFD700) 1",
        },
      };
    case "soft-glow":
      return {
        style: {
          boxShadow: "0 0 24px 6px rgba(255, 210, 120, 0.55)",
        },
      };
    case "starry-border":
      return {
        style: { border: "3px dashed #8A79B8" },
        cornerStars: true,
      };
    default:
      return NO_DECORATION;
  }
}
