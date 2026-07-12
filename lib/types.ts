export type Mood = "happy" | "sad" | "angry" | "thoughtful" | "love";

// Полная строка из БД — только для сервера (API-роуты, админ-панель).
// НИКОГДА не отправляй это как есть в браузер: session_id — ключ анонимной
// сессии (like/report/create доверяют ему напрямую), а likes_count скрыт по
// требованию продукта (публичный счётчик превращает "Услышано" в
// соревнование). См. lib/publicSticker.ts — единственное место, где Sticker
// превращается в то, что реально можно показать клиенту.
export interface Sticker {
  id: string;
  text: string;
  mood: Mood;
  position_x: number;
  position_y: number;
  rotation: number;
  decoration_id: string | null;
  is_sponsored: boolean;
  sponsor_url: string | null;
  session_id: string;
  likes_count: number;
  report_count: number;
  is_hidden: boolean;
  created_at: string;
  expires_at: string;
}

// То, что реально уходит в браузер (initial render, Realtime, ответ API).
// Без session_id. Без реального числа лайков — только has_reactions,
// и то видимый только когда is_own (см. StickerCard).
export interface PublicSticker {
  id: string;
  text: string;
  mood: Mood;
  position_x: number;
  position_y: number;
  rotation: number;
  decoration_id: string | null;
  is_sponsored: boolean;
  sponsor_url: string | null;
  is_hidden: boolean;
  created_at: string;
  expires_at: string;
  is_own: boolean;
  has_reactions: boolean;
}

export interface StickerWithLikedState extends PublicSticker {
  liked_by_me: boolean;
}
