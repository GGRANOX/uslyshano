import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOOD_MAP, CARD_BG, CARD_TEXT } from "@/lib/moods";
import type { Mood } from "@/lib/types";

export const runtime = "nodejs";

const SIZE = 1080;
const TEASER_LENGTH = 220;

// Картинка для шеринга в соцсети из "Рандомного листа" (changelog
// "Услышано" п.3) — "не просто копирует ссылку на сайт". Рендерится
// сервером через next/og, поэтому одинаково выглядит независимо от
// браузера/устройства того, кто делится, и её можно открыть напрямую как
// картинку (кнопка "Поделиться" в RandomStickerModal делает именно это).
//
// Стили декораций (border-image/conic-gradient) не переносим сюда — Satori
// (рендерер next/og) поддерживает только подмножество CSS на flexbox, без
// border-image. Достаточно того же настроения/эмодзи/текста.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: sticker } = await supabase
    .from("stickers")
    .select("text, mood, is_hidden, expires_at")
    .eq("id", id)
    .maybeSingle();

  const isGone =
    !sticker || sticker.is_hidden || new Date(sticker.expires_at).getTime() < Date.now();

  if (isGone) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#2E2822",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 64 }}>🫂</div>
          <div style={{ fontSize: 40, color: "#F3EBDB", marginTop: 24 }}>
            Это сообщение уже исчезло
          </div>
          <div style={{ fontSize: 28, color: "#C9BBA0", marginTop: 16 }}>Услышано</div>
        </div>
      ),
      { width: SIZE, height: SIZE }
    );
  }

  const mood = MOOD_MAP[sticker.mood as Mood];
  const text =
    sticker.text.length > TEASER_LENGTH
      ? `${sticker.text.slice(0, TEASER_LENGTH).trimEnd()}…`
      : sticker.text;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2E2822",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: SIZE - 160,
            height: SIZE - 160,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            borderRadius: 48,
            backgroundColor: CARD_BG,
          }}
        >
          <div style={{ fontSize: 96, display: "flex" }}>{mood.emoji}</div>
          <div
            style={{
              fontSize: text.length > 120 ? 40 : 52,
              lineHeight: 1.35,
              color: CARD_TEXT,
              display: "flex",
            }}
          >
            {text}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: mood.accent,
              }}
            >
              Анонимно. Услышано.
            </div>
          </div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
