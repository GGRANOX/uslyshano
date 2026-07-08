import type { Mood } from "./types";

export interface MoodConfig {
  key: Mood;
  emoji: string;
  label: string;
  cardBg: string;
  accent: string;
}

// Палитра — раздел 4 ТЗ. cardBg/accent идут прямо в inline-style карточки,
// т.к. они завязаны на mood из данных, а не на статический класс Tailwind.
export const MOODS: MoodConfig[] = [
  { key: "happy", emoji: "😊", label: "Радостное", cardBg: "#FFF6DA", accent: "#E3A93B" },
  { key: "sad", emoji: "😢", label: "Грустное", cardBg: "#DFE9F6", accent: "#6B87AC" },
  { key: "angry", emoji: "😠", label: "Злое", cardBg: "#FBE3DD", accent: "#C1554A" },
  { key: "thoughtful", emoji: "🤔", label: "Задумчивое", cardBg: "#E9E3F6", accent: "#8A79B8" },
  { key: "love", emoji: "🥰", label: "Нежное", cardBg: "#FCE1EA", accent: "#C96E8D" },
];

export const MOOD_MAP: Record<Mood, MoodConfig> = Object.fromEntries(
  MOODS.map((m) => [m.key, m])
) as Record<Mood, MoodConfig>;
