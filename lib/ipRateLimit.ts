import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Лимиты по IP поверх лимитов по сессии (миграция 0010). Сессия — это просто
// cookie, скрипт без неё получает новую на каждый запрос; IP так легко не
// сменить. Лимиты мягкие: мобильные операторы в РК часто выводят много
// абонентов через один IP (CGNAT), так что задача — остановить скрипты, а не
// живых людей. Для сравнения, лимит на сессию — 8 постов и 10 жалоб в час.
export const IP_LIMITS = {
  post: { limit: 30, windowSeconds: 60 * 60 },
  report: { limit: 30, windowSeconds: 60 * 60 },
  like: { limit: 300, windowSeconds: 60 * 60 },
} as const;

export type IpLimitBucket = keyof typeof IP_LIMITS;

// IP клиента. На Vercel x-forwarded-for выставляет сама платформа (первый
// адрес — реальный клиент), подделать его снаружи нельзя. На другом хостинге
// убедитесь, что прокси перед приложением перезаписывает этот заголовок.
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || null;
}

function hashIp(ip: string): string {
  // IP_HASH_SECRET — отдельный секрет; если не задан, берём service role key
  // (он тоже секретный и уже есть на сервере), чтобы защита не отключалась
  // молча из-за забытой переменной.
  const secret = process.env.IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("IP_HASH_SECRET не задан");
  // Дата (UTC) в хэше: в разные дни один и тот же IP даёт разные хэши.
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`${day}|${ip}`).digest("hex");
}

export type IpLimitResult = "ok" | "limited" | "error";

// "error" — проверку выполнить не удалось; вызывающий роут отвечает 503
// (fail closed — сбой не должен отключать защиту от спама).
export async function hitIpLimit(
  supabase: SupabaseClient,
  request: Request,
  bucket: IpLimitBucket
): Promise<IpLimitResult> {
  const ip = getClientIp(request);
  if (!ip) {
    // Локальная разработка без прокси — заголовка нет. Считать всех за один
    // "unknown" IP нельзя: на хостинге без x-forwarded-for это заблокировало
    // бы вообще всех пользователей разом.
    if (process.env.NODE_ENV === "production") {
      console.warn("hitIpLimit: не удалось определить IP клиента, лимит по IP пропущен");
    }
    return "ok";
  }

  const { limit, windowSeconds } = IP_LIMITS[bucket];
  try {
    const { data, error } = await supabase.rpc("hit_rate_limit", {
      p_bucket: bucket,
      p_key_hash: hashIp(ip),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("hit_rate_limit failed", error);
      return "error";
    }
    return data === true ? "ok" : "limited";
  } catch (error) {
    console.error("hit_rate_limit failed", error);
    return "error";
  }
}
