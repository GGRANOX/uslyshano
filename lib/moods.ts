import type { Mood } from "./types";

export interface MoodConfig {
  key: Mood;
  emoji: string;
  label: string;
  accent: string;
}

// Бумажная палитра (обновление дизайна, см. uslyshano-design.md). Фон
// карточки больше не зависит от настроения — только accent, который идёт в
// точку-метку настроения (8×8px) и бейдж "исчезнет через N дн.".
export const MOODS: MoodConfig[] = [
  { key: "happy", emoji: "😊", label: "Радостное", accent: "#D6A23E" },
  { key: "sad", emoji: "😢", label: "Грустное", accent: "#5C7A94" },
  { key: "angry", emoji: "😠", label: "Злое", accent: "#A8453A" },
  { key: "thoughtful", emoji: "🤔", label: "Задумчивое", accent: "#8A79B8" },
  { key: "love", emoji: "🥰", label: "Нежное", accent: "#C96E8D" },
];

// Бумажная карточка-стикер — фиксированные цвета, не зависят от настроения
// (uslyshano-design.md). AGED — последние ~24ч перед исчезновением.
export const CARD_BG = "#F3EBDB";
export const CARD_BG_AGED = "#E4D5B8";
export const CARD_TEXT = "#2A2420";

// Фон холста: тёмный (по умолчанию, "доска при лампе") и светлый вариант,
// переключаются кнопкой в шапке (см. Header/WallCanvas).
export const WALL_BG_DARK = "#2E2822";
export const WALL_BG_LIGHT = "#DCCBAA";
export const WALL_TEXT_MUTED_DARK = "#C9BBA0";
export const WALL_TEXT_MUTED_LIGHT = "#6B5A3E";

export const MOOD_MAP: Record<Mood, MoodConfig> = Object.fromEntries(
  MOODS.map((m) => [m.key, m])
) as Record<Mood, MoodConfig>;
