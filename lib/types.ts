export type Mood = "happy" | "sad" | "angry" | "thoughtful" | "love";

export interface Sticker {
  id: string;
  text: string;
  mood: Mood;
  position_x: number;
  position_y: number;
  rotation: number;
  decoration_id: string | null;
  is_sponsored: boolean;
  session_id: string;
  likes_count: number;
  report_count: number;
  is_hidden: boolean;
  created_at: string;
  expires_at: string;
}

export interface StickerWithLikedState extends Sticker {
  liked_by_me: boolean;
}
