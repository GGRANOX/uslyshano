import "server-only";
import { getClientIp } from "./ipRateLimit";

// Cloudflare Turnstile — капча, обычно невидимая (см. components/turnstile.ts).
// Включается переменной TURNSTILE_SECRET_KEY: без неё проверка пропускается
// (локальная разработка). В продакшене задайте и её, и
// NEXT_PUBLIC_TURNSTILE_SITE_KEY — иначе защиты от ботов нет.
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export type TurnstileResult = "ok" | "failed" | "error";

export async function verifyTurnstile(
  token: unknown,
  request: Request
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "ok";

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return "failed";
  }

  const form = new URLSearchParams({ secret, response: token });
  const ip = getClientIp(request);
  if (ip) form.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("Turnstile siteverify HTTP", response.status);
      return "error";
    }
    const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("Turnstile rejected token", data["error-codes"]);
      return "failed";
    }
    return "ok";
  } catch (error) {
    // Fail closed: если Cloudflare недоступен, не пропускаем запрос молча.
    console.error("Turnstile siteverify failed", error);
    return "error";
  }
}
